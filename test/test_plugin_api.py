"""Unit tests for dashboard/plugin_api.py read-only SQLite ledger builder."""

from __future__ import annotations

import importlib.util
import sqlite3
import sys
import tempfile
import types
import unittest
from pathlib import Path


def _load_plugin_api_module():
    # Provide lightweight stubs when running outside the Hermes virtualenv
    if "fastapi" not in sys.modules:
        fake_fastapi = types.ModuleType("fastapi")

        class _StubRouter:
            def get(self, _path):
                def _decorator(fn):
                    return fn
                return _decorator

        fake_fastapi.APIRouter = _StubRouter
        sys.modules["fastapi"] = fake_fastapi

    if "hermes_constants" not in sys.modules:
        fake_hc = types.ModuleType("hermes_constants")
        fake_hc.get_default_hermes_root = lambda: Path.home() / ".hermes"
        fake_hc.get_hermes_home = lambda: Path.home() / ".hermes"
        sys.modules["hermes_constants"] = fake_hc

    api_path = Path(__file__).resolve().parent.parent / "dashboard" / "plugin_api.py"
    spec = importlib.util.spec_from_file_location("test_context_bar_plugin_api", api_path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


plugin_api = _load_plugin_api_module()


def _init_sample_db(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            source TEXT,
            title TEXT,
            hidden INTEGER DEFAULT 0,
            archived INTEGER DEFAULT 0,
            parent_session_id TEXT,
            model TEXT,
            billing_provider TEXT,
            billing_base_url TEXT,
            billing_mode TEXT,
            cost_status TEXT,
            started_at REAL,
            last_activity_at REAL,
            api_call_count INTEGER DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            cache_write_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            reasoning_tokens INTEGER DEFAULT 0,
            actual_cost_usd REAL DEFAULT 0.0,
            estimated_cost_usd REAL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE session_model_usage (
            session_id TEXT,
            task TEXT,
            model TEXT,
            billing_provider TEXT,
            billing_base_url TEXT,
            billing_mode TEXT,
            cost_status TEXT,
            api_call_count INTEGER DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            cache_write_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            reasoning_tokens INTEGER DEFAULT 0,
            actual_cost_usd REAL DEFAULT 0.0,
            estimated_cost_usd REAL,
            first_seen REAL,
            last_seen REAL
        )
        """
    )
    return conn


class PluginApiLedgerTests(unittest.TestCase):
    def test_multi_profile_full_ledger_and_profile_root_unwrap(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "profiles" / "scout").mkdir(parents=True)
            (root / "config.yaml").write_text(
                "ui_meta:\n  hermes-bots:\n    title: 总管\nmodel:\n  default: gemini-4-neon\n  provider: gemini\n",
                encoding="utf-8",
            )
            (root / "profiles" / "scout" / "config.yaml").write_text(
                "ui_meta:\n  hermes-bots:\n    title: 情报官\nmodel:\n  default: gemini-4-hydrogen\n  provider: gemini\n",
                encoding="utf-8",
            )

            # Populate default state.db: hidden Bot Chat (with actual_cost_usd=0.0 default!), subagent, and aux tasks
            c_def = _init_sample_db(root / "state.db")
            c_def.execute(
                """
                INSERT INTO sessions (
                    id, source, title, hidden, model, billing_provider, started_at, last_activity_at,
                    api_call_count, input_tokens, cache_read_tokens, output_tokens, actual_cost_usd, estimated_cost_usd, cost_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "bot-def", "local", "Bot Chat", 1, "gemini-4-neon", "gemini",
                    1795700000.0, 1795760000.0, 40, 4013090, 15818143, 139445, 0.0, 16.5037, "estimated",
                ),
            )
            # Subscription-included session with 0.0 cost
            c_def.execute(
                """
                INSERT INTO sessions (
                    id, source, title, hidden, model, billing_provider, billing_mode, cost_status,
                    started_at, last_activity_at, input_tokens, output_tokens, actual_cost_usd, estimated_cost_usd
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "sub-codex", "desktop", "Codex Chat", 0, "gpt-6.2-sol", "openai-codex",
                    "subscription_included", "included", 1795750000.0, 1795760000.0, 200000, 30000, 0.0, 0.0,
                ),
            )
            # Main turn in session_model_usage (task == '') MUST NOT be duplicated
            c_def.execute(
                """
                INSERT INTO session_model_usage (
                    session_id, task, model, billing_provider, input_tokens, output_tokens, actual_cost_usd, estimated_cost_usd
                ) VALUES ('bot-def', '', 'gemini-4-neon', 'gemini', 4013090, 139445, 0.0, 16.5037)
                """
            )
            # Auxiliary background_review row (task != '') MUST be included with estimated_cost_usd preserved despite actual_cost_usd=0.0!
            c_def.execute(
                """
                INSERT INTO session_model_usage (
                    session_id, task, model, billing_provider, api_call_count,
                    input_tokens, cache_read_tokens, output_tokens, actual_cost_usd, estimated_cost_usd, first_seen, last_seen
                ) VALUES ('bot-def', 'background_review', 'gemini-4-neon', 'gemini', 31, 290717, 4079501, 37926, 0.0, 2.052966, 1795655527.0, 1795763997.0)
                """
            )
            # Legacy auxiliary row with NULL first_seen/last_seen MUST inherit parent session timestamps via LEFT JOIN!
            c_def.execute(
                """
                INSERT INTO session_model_usage (
                    session_id, task, model, billing_provider, api_call_count,
                    input_tokens, output_tokens, actual_cost_usd, estimated_cost_usd, first_seen, last_seen
                ) VALUES ('bot-def', 'vision', 'gemini-3.1-flash-lite', 'gemini', 1, 10000, 2000, 0.0, 0.0055, NULL, NULL)
                """
            )
            c_def.commit()
            c_def.close()

            # Populate scout state.db
            c_sct = _init_sample_db(root / "profiles" / "scout" / "state.db")
            c_sct.execute(
                """
                INSERT INTO sessions (
                    id, source, title, hidden, model, billing_provider, started_at, last_activity_at,
                    input_tokens, cache_read_tokens, output_tokens, actual_cost_usd, estimated_cost_usd, cost_status
                ) VALUES ('bot-sct', 'local', 'Bot Chat', 1, 'gemini-4-hydrogen', 'gemini', 1795700000.0, 1795760000.0, 202334, 150549, 9990, 0.0, 0.3897, 'estimated')
                """
            )
            c_sct.commit()
            c_sct.close()

            snap_from_root = plugin_api.build_ledger_snapshot(root)
            snap_from_secondary = plugin_api.build_ledger_snapshot(root / "profiles" / "scout")

            self.assertTrue(snap_from_root["ok"])
            self.assertEqual([p["name"] for p in snap_from_root["profiles"]], ["default", "scout"])
            self.assertEqual(snap_from_root["profiles"][0]["title"], "总管")
            self.assertEqual(snap_from_root["profiles"][1]["title"], "情报官")

            # Identical entries whether invoked from launch root or secondary profile host!
            self.assertEqual(snap_from_root["entries"], snap_from_secondary["entries"])
            self.assertEqual(len(snap_from_root["entries"]), 5)

            by_id = {e["id"]: e for e in snap_from_root["entries"]}
            self.assertNotIn("actual_cost_usd", by_id["bot-def"])
            self.assertAlmostEqual(by_id["bot-def"]["estimated_cost_usd"], 16.5037, places=4)
            self.assertEqual(by_id["sub-codex"]["estimated_cost_usd"], 0.0)
            self.assertEqual(by_id["sub-codex"]["cost_status"], "included")

            aux_key = "aux:bot-def:background_review:gemini-4-neon:gemini"
            self.assertIn(aux_key, by_id)
            self.assertTrue(by_id[aux_key]["_is_aux"])
            self.assertAlmostEqual(by_id[aux_key]["estimated_cost_usd"], 2.052966, places=5)

            vision_key = "aux:bot-def:vision:gemini-3.1-flash-lite:gemini"
            self.assertIn(vision_key, by_id)
            self.assertEqual(by_id[vision_key]["started_at"], 1795700000.0)
            self.assertEqual(by_id[vision_key]["last_active"], 1795760000.0)


if __name__ == "__main__":
    unittest.main()
