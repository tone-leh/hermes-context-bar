"""Context Bar dashboard API — read-only SQLite usage & auxiliary-task ledger.

Mounted at ``/api/plugins/hermes-context-bar/`` when ``hermes-context-bar`` is
installed under ``<HERMES_HOME>/plugins/`` and listed in ``plugins.enabled``.
Provides a single read-only ``GET /ledger`` endpoint consumed by the Hermes
Desktop status-bar chip via the official ``ctx.rest('/ledger')`` SDK door.

Security & boundary guarantees:
- Strictly read-only SQLite access (``?mode=ro`` + ``PRAGMA query_only = ON``).
- Uses only Python stdlib, FastAPI ``APIRouter``, and the published
  ``hermes_constants`` API (zero private Hermes core imports).
- Never reads secrets, ``.env``, API keys, OAuth tokens, or message bodies.
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter
from hermes_constants import get_default_hermes_root, get_hermes_home

router = APIRouter()

_LEDGER_CACHE_TTL_SECONDS = 1.5
_cache_lock = threading.Lock()
_cached_key: Optional[tuple] = None
_cached_at: float = 0.0
_cached_payload: Optional[dict[str, Any]] = None

_ZERO_MARGINAL_MODES = frozenset({"subscription_included"})
_ZERO_MARGINAL_STATUSES = frozenset({"included"})


def _resolve_hermes_root(explicit_root: Optional[Path] = None) -> Path:
    """Resolve the top-level Hermes root directory across launch and secondary profile hosts."""
    if explicit_root is not None:
        base = Path(explicit_root)
    else:
        try:
            base = Path(get_default_hermes_root())
        except Exception:
            base = Path(get_hermes_home())

    resolved = base.expanduser().resolve(strict=False)
    if resolved.parent.name == "profiles" and (resolved.parent.parent / "profiles").is_dir():
        return resolved.parent.parent
    return resolved


def _iter_profile_homes(root: Path) -> list[tuple[str, Path]]:
    """Return ``(profile_slug, profile_home)`` pairs for ``default`` and all named profiles."""
    homes: list[tuple[str, Path]] = [("default", root)]
    profiles_dir = root / "profiles"
    try:
        if profiles_dir.is_dir():
            for child in sorted(profiles_dir.iterdir(), key=lambda p: p.name):
                if not child.name.startswith(".") and child.is_dir():
                    homes.append((child.name, child))
    except OSError:
        pass
    return homes


def _extract_safe_profile_meta(profile_slug: str, home: Path) -> dict[str, str]:
    """Lightweight, secret-free parser for non-sensitive display/model metadata in config.yaml.

    Intentionally avoids reading any secret/env files or sensitive keys.
    """
    meta = {
        "name": profile_slug,
        "title": "",
        "model": "",
        "provider": "",
        "base_url": "",
    }
    cfg_path = home / "config.yaml"
    try:
        if not cfg_path.is_file():
            return meta
        lines = cfg_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return meta

    top_section = ""
    sub_section = ""
    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if indent == 0 and stripped.endswith(":") and ":" not in stripped[:-1]:
            top_section = stripped[:-1].strip()
            sub_section = ""
            continue
        if indent == 2 and stripped.endswith(":") and ":" not in stripped[:-1]:
            sub_section = stripped[:-1].strip()
            continue
        if ":" not in stripped:
            continue
        key, _, raw_val = stripped.partition(":")
        key = key.strip()
        val = raw_val.split(" #", 1)[0].strip().strip("'\"")
        if not val:
            continue

        if indent == 0 and key in ("display_name", "bot_title") and not meta["title"]:
            meta["title"] = val
        elif top_section == "ui_meta" and sub_section == "hermes-bots" and key == "title":
            meta["title"] = val
        elif top_section == "model" and indent == 2:
            if key in ("default", "model") and not meta["model"]:
                meta["model"] = val
            elif key == "provider" and not meta["provider"]:
                meta["provider"] = val
            elif key == "base_url" and not meta["base_url"]:
                meta["base_url"] = val

    return meta


def _db_fingerprint(homes: list[tuple[str, Path]]) -> tuple:
    """Compute a fast stat fingerprint over all state.db / state.db-wal files."""
    parts: list[tuple[str, int, int, int, int]] = []
    for slug, home in homes:
        db_file = home / "state.db"
        wal_file = home / "state.db-wal"
        db_m, db_s = 0, 0
        wal_m, wal_s = 0, 0
        try:
            st = db_file.stat()
            db_m, db_s = st.st_mtime_ns, st.st_size
        except OSError:
            pass
        try:
            wst = wal_file.stat()
            wal_m, wal_s = wst.st_mtime_ns, wst.st_size
        except OSError:
            pass
        parts.append((slug, db_m, db_s, wal_m, wal_s))
    return tuple(parts)


def _open_readonly_sqlite(db_path: Path) -> sqlite3.Connection:
    uri = db_path.resolve(strict=False).as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=2.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    return conn


def _table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    try:
        rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
        return {str(r[1]) for r in rows}
    except sqlite3.Error:
        return set()


def _normalize_cost_fields(
    actual_raw: Any,
    estimated_raw: Any,
    cost_status: str,
    billing_mode: str,
) -> tuple[Optional[float], Optional[float]]:
    """Normalize SQLite cost columns where ``actual_cost_usd`` defaults to ``0.0`` even when unset."""
    is_included = (
        cost_status.lower() in _ZERO_MARGINAL_STATUSES
        or billing_mode.lower() in _ZERO_MARGINAL_MODES
    )
    actual_val: Optional[float] = None
    if isinstance(actual_raw, (int, float)) and actual_raw > 0:
        actual_val = float(actual_raw)

    est_val: Optional[float] = None
    if isinstance(estimated_raw, (int, float)):
        if estimated_raw > 0 or is_included:
            est_val = float(estimated_raw)
    elif is_included:
        est_val = 0.0

    return actual_val, est_val


def _scan_one_profile_db(
    profile_slug: str,
    db_path: Path,
    profile_meta: dict[str, str],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if not db_path.is_file():
        return entries

    try:
        with closing(_open_readonly_sqlite(db_path)) as conn:
            s_cols = _table_columns(conn, "sessions")
            if "id" in s_cols:
                def s_col(name: str, fallback: str = "NULL") -> str:
                    return name if name in s_cols else f"{fallback} AS {name}"

                s_query = f"""
                    SELECT
                        id,
                        {s_col("source", "'local'")},
                        {s_col("title", "''")},
                        {s_col("hidden", "0")},
                        {s_col("archived", "0")},
                        {s_col("parent_session_id", "NULL")},
                        {s_col("end_reason", "''")},
                        {s_col("model", "''")},
                        {s_col("billing_provider", "''")},
                        {s_col("billing_base_url", "''")},
                        {s_col("billing_mode", "''")},
                        {s_col("cost_status", "''")},
                        {s_col("started_at", "NULL")},
                        {s_col("last_activity_at", "NULL")},
                        {s_col("api_call_count", "0")},
                        {s_col("input_tokens", "0")},
                        {s_col("cache_read_tokens", "0")},
                        {s_col("cache_write_tokens", "0")},
                        {s_col("output_tokens", "0")},
                        {s_col("reasoning_tokens", "0")},
                        {s_col("actual_cost_usd", "NULL")},
                        {s_col("estimated_cost_usd", "NULL")}
                    FROM sessions
                    WHERE (
                        COALESCE({"input_tokens" if "input_tokens" in s_cols else "0"}, 0) +
                        COALESCE({"cache_read_tokens" if "cache_read_tokens" in s_cols else "0"}, 0) +
                        COALESCE({"cache_write_tokens" if "cache_write_tokens" in s_cols else "0"}, 0) +
                        COALESCE({"output_tokens" if "output_tokens" in s_cols else "0"}, 0) +
                        COALESCE({"reasoning_tokens" if "reasoning_tokens" in s_cols else "0"}, 0) +
                        COALESCE({"actual_cost_usd" if "actual_cost_usd" in s_cols else "0"}, 0) +
                        COALESCE({"estimated_cost_usd" if "estimated_cost_usd" in s_cols else "0"}, 0)
                    ) > 0
                """
                for row in conn.execute(s_query):
                    sid = str(row["id"] or "").strip()
                    if not sid:
                        continue
                    cost_status = str(row["cost_status"] or "").strip()
                    billing_mode = str(row["billing_mode"] or "").strip()
                    actual_val, est_val = _normalize_cost_fields(
                        row["actual_cost_usd"],
                        row["estimated_cost_usd"],
                        cost_status,
                        billing_mode,
                    )
                    started_at = row["started_at"]
                    last_active = row["last_activity_at"] if row["last_activity_at"] is not None else started_at
                    model_name = str(row["model"] or profile_meta.get("model") or "").strip()
                    provider_name = str(row["billing_provider"] or profile_meta.get("provider") or "").strip()
                    base_url = str(row["billing_base_url"] or "").strip()

                    entry: dict[str, Any] = {
                        "id": sid,
                        "profile": profile_slug,
                        "_profile": profile_slug,
                        "source": str(row["source"] or "local"),
                        "title": str(row["title"] or ""),
                        "hidden": bool(row["hidden"]),
                        "archived": bool(row["archived"]),
                        "parent_session_id": row["parent_session_id"],
                        "end_reason": str(row["end_reason"] or ""),
                        "model": model_name,
                        "billing_provider": provider_name,
                        "billing_base_url": base_url,
                        "billing_mode": billing_mode,
                        "cost_status": cost_status or ("estimated" if est_val is not None and actual_val is None else ""),
                        "started_at": started_at,
                        "last_active": last_active,
                        "api_call_count": int(row["api_call_count"] or 0),
                        "input_tokens": int(row["input_tokens"] or 0),
                        "cache_read_tokens": int(row["cache_read_tokens"] or 0),
                        "cache_write_tokens": int(row["cache_write_tokens"] or 0),
                        "output_tokens": int(row["output_tokens"] or 0),
                        "reasoning_tokens": int(row["reasoning_tokens"] or 0),
                    }
                    if actual_val is not None:
                        entry["actual_cost_usd"] = actual_val
                    if est_val is not None:
                        entry["estimated_cost_usd"] = est_val
                    entries.append(entry)

            # Auxiliary LLM usage (vision, compression, background_review, title_generation, etc.)
            # Primary conversation turns have ``task == ''`` and are already accounted for in ``sessions``.
            u_cols = _table_columns(conn, "session_model_usage")
            if "session_id" in u_cols and "task" in u_cols:
                def u_col(name: str, fallback: str = "NULL") -> str:
                    return f"u.{name}" if name in u_cols else f"{fallback} AS {name}"

                has_sessions_join = "id" in s_cols
                join_clause = "LEFT JOIN sessions s ON s.id = u.session_id" if has_sessions_join else ""
                s_started_expr = "s.started_at" if (has_sessions_join and "started_at" in s_cols) else "NULL"
                s_active_expr = (
                    "s.last_activity_at"
                    if (has_sessions_join and "last_activity_at" in s_cols)
                    else s_started_expr
                )
                u_first_raw = "u.first_seen" if "first_seen" in u_cols else "NULL"
                u_last_raw = "u.last_seen" if "last_seen" in u_cols else "NULL"

                u_query = f"""
                    SELECT
                        u.session_id AS session_id,
                        u.task AS task,
                        {u_col("model", "''")},
                        {u_col("billing_provider", "''")},
                        {u_col("billing_base_url", "''")},
                        {u_col("billing_mode", "''")},
                        {u_col("cost_status", "''")},
                        {u_col("api_call_count", "0")},
                        {u_col("input_tokens", "0")},
                        {u_col("cache_read_tokens", "0")},
                        {u_col("cache_write_tokens", "0")},
                        {u_col("output_tokens", "0")},
                        {u_col("reasoning_tokens", "0")},
                        {u_col("actual_cost_usd", "NULL")},
                        {u_col("estimated_cost_usd", "NULL")},
                        COALESCE({u_first_raw}, {s_started_expr}, {s_active_expr}) AS first_seen,
                        COALESCE({u_last_raw}, {u_first_raw}, {s_active_expr}, {s_started_expr}) AS last_seen
                    FROM session_model_usage u
                    {join_clause}
                    WHERE COALESCE(u.task, '') != ''
                      AND (
                        COALESCE({"u.input_tokens" if "input_tokens" in u_cols else "0"}, 0) +
                        COALESCE({"u.cache_read_tokens" if "cache_read_tokens" in u_cols else "0"}, 0) +
                        COALESCE({"u.cache_write_tokens" if "cache_write_tokens" in u_cols else "0"}, 0) +
                        COALESCE({"u.output_tokens" if "output_tokens" in u_cols else "0"}, 0) +
                        COALESCE({"u.reasoning_tokens" if "reasoning_tokens" in u_cols else "0"}, 0) +
                        COALESCE({"u.actual_cost_usd" if "actual_cost_usd" in u_cols else "0"}, 0) +
                        COALESCE({"u.estimated_cost_usd" if "estimated_cost_usd" in u_cols else "0"}, 0)
                      ) > 0
                """
                for row in conn.execute(u_query):
                    parent_sid = str(row["session_id"] or "global").strip() or "global"
                    task_name = str(row["task"] or "aux").strip()
                    model_name = str(row["model"] or profile_meta.get("model") or "").strip()
                    provider_name = str(row["billing_provider"] or profile_meta.get("provider") or "").strip()
                    cost_status = str(row["cost_status"] or "").strip()
                    billing_mode = str(row["billing_mode"] or "").strip()
                    actual_val, est_val = _normalize_cost_fields(
                        row["actual_cost_usd"],
                        row["estimated_cost_usd"],
                        cost_status,
                        billing_mode,
                    )
                    first_seen = row["first_seen"]
                    last_seen = row["last_seen"] if row["last_seen"] is not None else first_seen
                    aux_id = f"aux:{parent_sid}:{task_name}:{model_name}:{provider_name}"

                    aux_entry: dict[str, Any] = {
                        "id": aux_id,
                        "_is_aux": True,
                        "task": task_name,
                        "parent_session_id": parent_sid,
                        "profile": profile_slug,
                        "_profile": profile_slug,
                        "source": f"aux:{task_name}",
                        "title": f"[Aux] {task_name}",
                        "hidden": True,
                        "archived": False,
                        "model": model_name,
                        "billing_provider": provider_name,
                        "billing_base_url": str(row["billing_base_url"] or "").strip(),
                        "billing_mode": billing_mode,
                        "cost_status": cost_status or ("estimated" if est_val is not None and actual_val is None else ""),
                        "started_at": first_seen,
                        "last_active": last_seen,
                        "api_call_count": int(row["api_call_count"] or 0),
                        "input_tokens": int(row["input_tokens"] or 0),
                        "cache_read_tokens": int(row["cache_read_tokens"] or 0),
                        "cache_write_tokens": int(row["cache_write_tokens"] or 0),
                        "output_tokens": int(row["output_tokens"] or 0),
                        "reasoning_tokens": int(row["reasoning_tokens"] or 0),
                    }
                    if actual_val is not None:
                        aux_entry["actual_cost_usd"] = actual_val
                    if est_val is not None:
                        aux_entry["estimated_cost_usd"] = est_val
                    entries.append(aux_entry)
    except sqlite3.Error:
        pass

    return entries


def build_ledger_snapshot(explicit_root: Optional[Path] = None) -> dict[str, Any]:
    """Read-only scan of all profile SQLite databases under the Hermes root."""
    global _cached_key, _cached_at, _cached_payload

    root = _resolve_hermes_root(explicit_root)
    homes = _iter_profile_homes(root)
    now_mono = time.monotonic()
    fp = (str(root), _db_fingerprint(homes))

    if explicit_root is None:
        with _cache_lock:
            if (
                _cached_payload is not None
                and _cached_key == fp
                and (now_mono - _cached_at) < _LEDGER_CACHE_TTL_SECONDS
            ):
                return _cached_payload

    profiles_out: list[dict[str, str]] = []
    all_entries: list[dict[str, Any]] = []

    for slug, home in homes:
        meta = _extract_safe_profile_meta(slug, home)
        profiles_out.append(meta)
        db_path = home / "state.db"
        all_entries.extend(_scan_one_profile_db(slug, db_path, meta))

    payload: dict[str, Any] = {
        "ok": True,
        "version": "1.0.2",
        "generated_at": time.time(),
        "profiles": profiles_out,
        "entries": all_entries,
    }

    if explicit_root is None:
        with _cache_lock:
            _cached_key = fp
            _cached_at = time.monotonic()
            _cached_payload = payload

    return payload


@router.get("/ledger")
async def get_usage_ledger() -> dict[str, Any]:
    """Return full multi-profile session & auxiliary-task usage ledger (strictly read-only)."""
    return await asyncio.to_thread(build_ledger_snapshot)
