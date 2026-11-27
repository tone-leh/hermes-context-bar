import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { STATUSBAR_AREAS, __setCompactNumber, host } from '@hermes/plugin-sdk';
import plugin, { __test } from '../desktop/plugin.js';

const {
  STYLE_ID,
  STORAGE_KEY,
  DEFAULT_PREFS,
  I18N,
  resolveLang,
  sanitizePrefs,
  loadPrefs,
  savePrefs,
  extractContextPolicy,
  buildConfigGetParams,
  mergeSdkConfigResponses,
  readPolicyViaSdk,
  ConfigPanel,
  toNum,
  toEpochMs,
  getTimeRangeCutoffMs,
  fmtCompact,
  fmtFull,
  fmtPct,
  fmtTps,
  estimateChunkTokens,
  fmtCurrency,
  normalizeThreshold,
  resolveModelName,
  pickBestNum,
  isPrivateOrLoopbackUrl,
  isZeroMarginalCostSource,
  extractSourceTokenBuckets,
  estimateRawTokensUsd,
  mergeUsageSources,
  estimateSessionCost,
  formatLocalDayKey,
  loadUsageLedger,
  saveUsageLedger,
  lookupLedgerBaseline,
  recordLedgerObservation,
  aggregatePersistedSessions,
  normalizeCategories,
  resolveRoute,
  loadAsyncRouteMap,
  gwCall,
  synthesizeCanonicalSessionRow,
  fetchBackendLedger,
  extractFocusedSessionFromLedger,
  discoverConnectionRoster,
  collectProfileSessionsForScope,
  resolveToneLevel,
  buildScopeLabel,
} = __test;

function approxEqual(actual, expected, eps = 1e-9) {
  assert.equal(typeof actual, 'number', `expected number, got ${typeof actual}`);
  assert.ok(Math.abs(actual - expected) <= eps, `expected ${actual} ≈ ${expected} (±${eps})`);
}

function createMockDocument(lang = '') {
  const headChildren = [];
  return {
    documentElement: { lang },
    head: {
      children: headChildren,
      appendChild(node) {
        headChildren.push(node);
        return node;
      },
    },
    getElementById(id) {
      return headChildren.find((el) => el.id === id) || null;
    },
    createElement(tagName) {
      const node = {
        tagName: String(tagName).toUpperCase(),
        id: '',
        textContent: '',
        removed: false,
        remove() {
          node.removed = true;
          const idx = headChildren.indexOf(node);
          if (idx >= 0) headChildren.splice(idx, 1);
        },
      };
      return node;
    },
  };
}

function createMockCtx() {
  const registered = [];
  const disposers = [];
  const store = new Map();
  return {
    registered,
    disposers,
    storage: {
      get(key, fallback = null) {
        return store.has(key) ? store.get(key) : fallback;
      },
      set(key, val) {
        store.set(key, val);
      },
    },
    register(item) {
      registered.push(item);
    },
    onDispose(fn) {
      disposers.push(fn);
    },
    disposeAll() {
      while (disposers.length) {
        const fn = disposers.pop();
        fn();
      }
    },
  };
}

function withGlobalOverride(key, value, fn) {
  const desc = Object.getOwnPropertyDescriptor(globalThis, key);
  const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, key);
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
    enumerable: desc ? desc.enumerable : true,
  });
  try {
    return fn();
  } finally {
    if (hadOwn && desc) {
      Object.defineProperty(globalThis, key, desc);
    } else {
      delete globalThis[key];
    }
  }
}

describe('plugin default export contract & register(ctx) lifecycle', () => {
  it('exposes required Hermes Desktop plugin metadata fields', () => {
    assert.equal(plugin.id, 'hermes-context-bar');
    assert.equal(plugin.name, 'Context Bar');
    assert.equal(typeof plugin.description, 'string');
    assert.ok(plugin.description.length > 20);
    assert.equal(plugin.defaultEnabled, true);
    assert.equal(typeof plugin.register, 'function');
  });

  it('injects styles, registers left status-bar chip, replaces prior style, and cleans up on dispose', () => {
    const doc = createMockDocument('en-US');
    withGlobalOverride('document', doc, () => {
      const ctx1 = createMockCtx();
      plugin.register(ctx1);

      assert.equal(doc.head.children.length, 1);
      const firstStyle = doc.getElementById(STYLE_ID);
      assert.ok(firstStyle);
      assert.equal(firstStyle.tagName, 'STYLE');
      assert.ok(firstStyle.textContent.includes('.lub-trigger'));

      assert.equal(ctx1.registered.length, 1);
      const entry = ctx1.registered[0];
      assert.equal(entry.id, 'chip');
      assert.equal(entry.area, STATUSBAR_AREAS.left);
      assert.equal(entry.order, 40);
      assert.equal(typeof entry.render, 'function');

      const vnode = entry.render();
      assert.equal(typeof vnode.type, 'function');
      assert.equal(vnode.props.ctx, ctx1);

      // Re-registering replaces the existing style tag instead of duplicating it
      const ctx2 = createMockCtx();
      plugin.register(ctx2);
      assert.equal(firstStyle.removed, true);
      assert.equal(doc.head.children.length, 1);
      const secondStyle = doc.getElementById(STYLE_ID);
      assert.ok(secondStyle);
      assert.notEqual(secondStyle, firstStyle);

      // Disposing removes the injected style element cleanly
      ctx2.disposeAll();
      assert.equal(secondStyle.removed, true);
      assert.equal(doc.getElementById(STYLE_ID), null);
      assert.equal(doc.head.children.length, 0);
    });
  });

  it('registers chip safely when document is unavailable (headless environment)', () => {
    withGlobalOverride('document', undefined, () => {
      const ctx = createMockCtx();
      plugin.register(ctx);
      assert.equal(ctx.registered.length, 1);
      assert.equal(ctx.registered[0].id, 'chip');
      assert.equal(ctx.disposers.length, 0);
    });
  });
});

describe('mergeUsageSources', () => {
  it('merges fields across live, rpc, persisted, and breakdown with expected precedence', () => {
    const merged = mergeUsageSources(
      { input: 12000, output: 3000, calls: 4, avg_tps: 42.5 },
      { input_tokens: 9000, output_tokens: 2000, reasoning_tokens: 800, context_max: 200000, avg_latency_s: 1.4 },
      { input_tokens: 5000, actual_cost_usd: 0.18, compression_count: 2 },
      {
        context_max: 256000,
        categories: [
          { id: 'conversation', tokens: 40000 },
          { id: 'tools', tokens: 24000 },
        ],
      }
    );

    assert.equal(merged.input, 12000);
    assert.equal(merged.output, 3000);
    assert.equal(merged.reasoning, 800);
    assert.equal(merged.total, 15000);
    assert.equal(merged.calls, 4);
    assert.equal(merged.ctxMax, 256000);
    assert.equal(merged.ctxUsed, 64000);
    approxEqual(merged.ctxPct, 25);
    assert.equal(merged.compressions, 2);
    assert.equal(merged.avgTps, 42.5);
    assert.equal(merged.avgLatency, 1.4);
    assert.equal(merged.backendCost, 0.18);
  });

  it('clamps context percentage to [0, 100]', () => {
    const over = mergeUsageSources({}, {}, {}, { context_used: 300000, context_max: 200000 });
    assert.equal(over.ctxPct, 100);

    const under = mergeUsageSources({}, {}, {}, { context_used: -50, context_max: 200000 });
    assert.equal(under.ctxPct, 0);
  });

  it('supports snake_case and camelCase cache read fields and derives cacheHitPct', () => {
    const variants = [
      { cache_read_tokens: 8000 },
      { cache_read: 8000 },
      { cacheRead: 8000 },
      { cacheReadTokens: 8000 },
      { cache_read_input_tokens: 8000 },
      { cached_tokens: 8000 },
      { cached_input_tokens: 8000 },
    ];

    for (const cacheObj of variants) {
      // input=2000 (uncached fresh) + cacheRead=8000 -> promptTokens=10000 -> 80% cacheHitPct
      const merged = mergeUsageSources({ input: 2000, ...cacheObj }, {}, {}, {});
      assert.equal(merged.input, 2000);
      assert.equal(merged.cacheRead, 8000);
      assert.equal(merged.promptTokens, 10000);
      assert.equal(merged.cacheHitPct, 80);
    }

    // Raw OpenAI shape with prompt_tokens + cached_input_tokens (no input_tokens): derives fresh input=15000
    const fromRpc = mergeUsageSources({}, { prompt_tokens: 20000, cached_input_tokens: 5000 }, {}, {});
    assert.equal(fromRpc.input, 15000);
    assert.equal(fromRpc.cacheRead, 5000);
    assert.equal(fromRpc.promptTokens, 20000);
    assert.equal(fromRpc.cacheHitPct, 25);

    // Persisted SQLite row: input_tokens=2000 (uncached) + cache_read_tokens=6000 -> promptTokens=8000 (75%)
    const fromPersisted = mergeUsageSources({}, {}, { input_tokens: 2000, cache_read_tokens: 6000 }, {});
    assert.equal(fromPersisted.input, 2000);
    assert.equal(fromPersisted.cacheRead, 6000);
    assert.equal(fromPersisted.promptTokens, 8000);
    assert.equal(fromPersisted.cacheHitPct, 75);

    // tui_usage shape (liveUsage / session.info.usage): uncached `input` + total `prompt` without `cache_read_tokens`
    const fromTuiUsage = mergeUsageSources(
      { input: 4_013_090, prompt: 19_831_233, output: 139_445, cache_hit_pct: 80 },
      {},
      {},
      {}
    );
    assert.equal(fromTuiUsage.input, 4_013_090);
    assert.equal(fromTuiUsage.cacheRead, 15_818_143);
    assert.equal(fromTuiUsage.promptTokens, 19_831_233);
    assert.equal(fromTuiUsage.total, 19_831_233 + 139_445);
  });

  it('prefers positive direct cacheHitPct, falls back to derived when direct is 0, and caps at 100', () => {
    const directWins = mergeUsageSources({ input: 5000, cache_read_tokens: 5000, cache_hit_pct: 62 }, {}, {}, {});
    assert.equal(directWins.cacheHitPct, 62);

    const zeroFallsBackToDerived = mergeUsageSources(
      { input: 2500, cache_read_tokens: 7500, cache_hit_pct: 0 },
      {},
      {},
      {}
    );
    assert.equal(zeroFallsBackToDerived.cacheHitPct, 75);

    const zeroWithoutCacheRead = mergeUsageSources({ input: 10000, cache_hit_pct: 0 }, {}, {}, {});
    assert.equal(zeroWithoutCacheRead.cacheHitPct, 0);

    const highHit = mergeUsageSources({ input: 0, cacheRead: 2500 }, {}, {}, {});
    assert.equal(highHit.cacheHitPct, 100);
  });

  it('handles null, undefined, and non-object inputs gracefully', () => {
    const empty = mergeUsageSources(null, undefined, 'invalid', 42);
    assert.deepEqual(empty, {
      input: null,
      cacheRead: null,
      cacheWrite: null,
      promptTokens: null,
      output: null,
      reasoning: null,
      total: null,
      calls: null,
      ctxUsed: null,
      ctxMax: null,
      ctxPct: null,
      cacheHitPct: null,
      compressions: null,
      avgTps: null,
      avgLatency: null,
      backendCost: null,
    });
  });
});

describe('estimateRawTokensUsd & estimateSessionCost', () => {
  it('matches official Google Cloud / AI Studio rates (including Carbon schedule & 200k tier) and returns null for unknown/empty inputs', () => {
    const nov2026 = Date.UTC(2026, 10, 27, 0, 0, 0);
    const dec2026 = Date.UTC(2026, 11, 1, 0, 0, 0);
    const jan2027 = Date.UTC(2027, 0, 2, 0, 0, 0);

    // Gemini 4 Carbon: verified live Google Cloud Billing SKU rate ($4/$20/$0.20)
    // Note: `input` is ALREADY uncached fresh input; `cacheRead` is billed IN ADDITION to `input`!
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-carbon', null, null, 0, null, nov2026), 24.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-carbon', 500_000, null, 0, null, dec2026), 24.1);
    // Exact production verification against Hermes `agent/usage_pricing.py` (gemini-4-neon $3/$15/$0.15):
    // 4,013,090 fresh in ($12.03927) + 15,818,143 cache read ($2.37272145) + 139,445 out ($2.091675) = $16.50366645
    approxEqual(
      estimateRawTokensUsd(4_013_090, 139_445, 'gemini-4-neon', 15_818_143, null, 54_392, null, nov2026),
      16.50366645
    );
    // Gemini 4 Neon ($3/$15/$0.15) & Hydrogen ($1.5/$7.5/$0.075)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-neon'), 18.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-hydrogen'), 9.0);
    // Gemini 3.8 Flash promo ($0.75/$3.75) vs 2027 standard ($1.50/$7.50) & 3.1 Flash-Lite ($0.25/$1.50)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-3.8-flash', null, null, 0, null, nov2026), 4.5);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-3.8-flash', null, null, 0, null, jan2027), 9.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-3.1-flash-lite'), 1.75);
    // Gemini 2.5 Flash Lite ($0.10/$0.40), 2.5 Flash ($0.15/$0.60), 2.5 Pro (<=200k $1.25/$10, >200k $2.50/$15)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-2.5-flash-lite'), 0.5);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-2.5-flash'), 0.75);
    approxEqual(estimateRawTokensUsd(100_000, 100_000, 'gemini-2.5-pro'), 1.125);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-2.5-pro'), 17.5);
    // Claude Sonnet 4 ($3/$15), Opus 4.8 ($5/$25), legacy Opus 4 ($15/$75)
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4'), 6.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 100_000, 'claude-opus-4-8'), 7.5);
    approxEqual(estimateRawTokensUsd(1_000_000, 100_000, 'anthropic/claude-opus-4'), 22.5);
    // GPT-4o-mini vs GPT-5/Codex vs o3 (direct pay-as-you-go API)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gpt-4o-mini'), 0.75);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'openai/gpt-5-codex'), 12.5);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'o3'), 50.0);
    // DeepSeek R1 vs DeepSeek Chat (V4 Flash rate)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'deepseek-r1'), 2.74);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'deepseek-chat'), 0.75);

    assert.equal(estimateRawTokensUsd(0, 0, 'claude-sonnet-4'), null);
    assert.equal(estimateRawTokensUsd(null, undefined, 'claude-sonnet-4'), null);
    assert.equal(estimateRawTokensUsd(1000, 500, ''), null);
    assert.equal(estimateRawTokensUsd(1000, 500, 'unknown-local-model-v1'), null);
  });

  it('treats ChatGPT subscription (openai-codex / chatgpt-sub / OpenCodex loopback) and local LAN models as $0.00 marginal cost', () => {
    assert.equal(isPrivateOrLoopbackUrl('http://127.0.0.1:10100/v1'), true);
    assert.equal(isPrivateOrLoopbackUrl('http://192.168.1.6:11434/v1'), true);
    assert.equal(isPrivateOrLoopbackUrl('https://generativelanguage.googleapis.com/v1beta'), false);

    assert.equal(isZeroMarginalCostSource({ billing_provider: 'openai-codex' }), true);
    assert.equal(isZeroMarginalCostSource({ provider: 'custom:chatgpt-sub' }), true);
    assert.equal(isZeroMarginalCostSource({ billing_base_url: 'http://127.0.0.1:10100/v1' }), true);
    assert.equal(isZeroMarginalCostSource({ cost_status: 'included' }), true);
    assert.equal(isZeroMarginalCostSource({ billing_provider: 'gemini', billing_base_url: 'https://generativelanguage.googleapis.com/v1beta' }), false);

    // Subscription session with 500k tokens resolves to exact $0.00 (not estimated OpenAI API rate)
    const mergedSub = mergeUsageSources(
      { input: 400_000, output: 100_000 },
      {},
      { billing_provider: 'custom:chatgpt-sub', billing_base_url: 'http://127.0.0.1:10100/v1' },
      {}
    );
    assert.equal(mergedSub.backendCost, 0);
    assert.deepEqual(estimateSessionCost(mergedSub, 'gpt-6.2-sol'), { amount: 0, estimated: false });

    // Multi-session aggregation: Google API bill ($1.80) + ChatGPT subscription ($0.00) stays exact $1.80
    const now = Date.UTC(2026, 10, 27, 12, 0, 0);
    const agg = aggregatePersistedSessions(
      [
        {
          id: 'gem-1',
          last_activity_at: now - 1000,
          input_tokens: 100_000,
          output_tokens: 100_000,
          estimated_cost_usd: 1.8,
          billing_provider: 'gemini',
          model: 'gemini-4-neon',
        },
        {
          id: 'sub-1',
          last_activity_at: now - 500,
          input_tokens: 500_000,
          output_tokens: 80_000,
          estimated_cost_usd: null,
          billing_provider: 'custom:chatgpt-sub',
          billing_base_url: 'http://127.0.0.1:10100/v1',
          model: 'gpt-6.2-sol',
        },
      ],
      'today',
      [],
      null,
      '',
      now
    );
    assert.equal(agg.sessionCount, 2);
    assert.equal(agg.input, 600_000);
    assert.equal(agg.output, 180_000);
    approxEqual(agg.costUsd, 1.8);
    assert.equal(agg.estimated, false);
  });

  it('bills uncached input and cacheRead additively without double-subtracting cacheRead from input', () => {
    // Claude Sonnet: [3.0, 15.0, 0.3]
    // 200k fresh uncached input + 800k cacheRead + 200k out = 0.60 + 0.24 + 3.00 = 3.84
    approxEqual(estimateRawTokensUsd(200_000, 200_000, 'claude-sonnet-4', 800_000), 3.84);

    // When cacheRead exceeds fresh input (the typical high-cache-hit session!), fresh input MUST NOT be zeroed out:
    // 1M fresh ($3.00) + 1.5M cacheRead ($0.45) + 200k out ($3.00) = $6.45
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', 1_500_000), 6.45);

    // Pure cacheRead (0 fresh input + 1M cacheRead + 0 out) still bills cacheRead accurately ($0.30)
    approxEqual(estimateRawTokensUsd(0, 0, 'claude-sonnet-4', 1_000_000), 0.3);

    // cacheHitPct fallback when explicit cacheRead is absent (splits combined input)
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', null, 50), 4.65);

    // cacheHitPct > 100 is clamped to 100%
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', null, 150), 3.3);
  });

  it('avoids double-billing reasoning tokens when already included in output/total', () => {
    // Total >= input + output + reasoning -> reasoning billed as separate output tokens
    approxEqual(
      estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', null, null, 100_000, 1_300_000),
      7.5
    );

    // Total == input + output -> reasoning is already inside output, do not double-bill
    approxEqual(
      estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', null, null, 100_000, 1_200_000),
      6.0
    );

    // Total missing -> conservative, do not double-bill reasoning
    approxEqual(
      estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', null, null, 100_000, null),
      6.0
    );
  });

  it('prefers backendCost in estimateSessionCost and marks estimated flag accurately', () => {
    assert.deepEqual(
      estimateSessionCost({ backendCost: 0.42, input: 1000, output: 500 }, 'claude-sonnet-4'),
      { amount: 0.42, estimated: false }
    );
    assert.deepEqual(
      estimateSessionCost({ backendCost: 0, input: 1000, output: 500 }, 'claude-sonnet-4'),
      { amount: 0, estimated: false }
    );

    const est = estimateSessionCost(
      { backendCost: null, input: 1_000_000, output: 0, cacheRead: 500_000, cacheHitPct: null, reasoning: 0, total: 1_500_000 },
      'claude-sonnet-4'
    );
    assert.equal(est.estimated, true);
    // 1M fresh ($3.00) + 500k cacheRead ($0.15) = $3.15
    approxEqual(est.amount, 3.15);

    assert.deepEqual(
      estimateSessionCost({ backendCost: null, input: 1000, output: 500 }, 'unknown-model'),
      { amount: null, estimated: true }
    );
  });
});

describe('multi-bot roster discovery, hidden Bot Chat backfill & cross-bot All-scope invariance', () => {
  it('resolves async host.profileRoutes and discovers full multi-bot roster even when secondary profiles are isolated', async () => {
    const routeMap = await loadAsyncRouteMap('tailscale-lemini', {
      profileRoutes: async () => [
        { connectionId: 'tailscale-lemini', mode: 'remote', profile: 'default', targetProfile: 'default' },
        { connectionId: 'tailscale-lemini', mode: 'remote', profile: 'scout', targetProfile: 'scout' },
        { connectionId: 'other-conn', mode: 'remote', profile: 'ignored', targetProfile: 'ignored' },
      ],
    });
    assert.deepEqual(Object.keys(routeMap).sort(), ['default', 'scout']);
    assert.equal(resolveRoute(null, 'scout', routeMap).connectionId, 'tailscale-lemini');

    // Simulate secondary profile `scout` returning only itself on `profiles.list`, while `default` returns all 4 bots
    const gwCalls = [];
    const roster = await discoverConnectionRoster({
      effectiveConnId: 'tailscale-lemini',
      routeMap,
      gwCallFn: async (route, method, params, profileHint) => {
        gwCalls.push({ profile: route?.profile || profileHint, method, params });
        if ((route?.profile || profileHint) === 'default' && method === 'profiles.list') {
          return {
            profiles: [
              { name: 'default', display_name: '总管', model: 'gemini-4-neon', provider: 'gemini', canonical_session: { id: 'bot-def', last_active: 1795758810 } },
              { name: 'scout', display_name: '情报官', model: 'gemini-4-hydrogen', provider: 'gemini', canonical_session: { id: 'bot-sct', last_active: 1795759312 } },
              { name: 'muse', display_name: '写作官', model: 'gemini-4-neon', provider: 'gemini', canonical_session: { id: 'bot-mus', last_active: 1795747401 } },
              { name: 'forge', display_name: '工程师', model: 'gemini-4-carbon', provider: 'gemini', canonical_session: { id: 'bot-frg', last_active: 1795748039 } },
            ],
          };
        }
        return { profiles: [{ name: 'scout' }] };
      },
      hostObj: {
        agents: async () => ({
          agents: [
            { connectionId: 'tailscale-lemini', profile: 'default', displayName: '总管' },
            { connectionId: 'other-host', profile: 'intruder', displayName: 'Intruder' },
          ],
        }),
      },
    });

    assert.deepEqual(roster.names, ['default', 'forge', 'muse', 'scout']);
    assert.equal(roster.titles.scout, '情报官');
    assert.equal(roster.canonicalByProfile.default.id, 'bot-def');
    assert.equal(gwCalls[0].profile, 'default');
  });

  it('backfills hidden Bot Chats across all 4 bots and produces identical All-Bots spend regardless of which bot is focused', async () => {
    const nowSec = 1795760000;
    const nowMs = nowSec * 1000;
    const canonicalByProfile = {
      default: { id: 'bot-def', last_active: nowSec - 100, started_at: nowSec - 86400 * 2 },
      scout: { id: 'bot-sct', last_active: nowSec - 200, started_at: nowSec - 86400 * 2 },
      muse: { id: 'bot-mus', last_active: nowSec - 300, started_at: nowSec - 86400 * 2 },
      forge: { id: 'bot-frg', last_active: nowSec - 400, started_at: nowSec - 86400 * 2 },
    };

    // Hidden Bot Chats are NOT in listPersistedSessions; only cron/subagent rows are
    const persistedByProfile = {
      default: [
        { id: 'sub-5', source: 'subagent', last_active: nowSec - 500, input_tokens: 315_693, cache_read_tokens: 5_200_681, output_tokens: 49_037, estimated_cost_usd: 1.641824, model: 'gemini-4-carbon' },
        { id: 'cron-d1', source: 'cron', last_active: nowSec - 600, input_tokens: 93_342, cache_read_tokens: 20_774, output_tokens: 6_038, estimated_cost_usd: 0.3737, model: 'gemini-4-neon' },
      ],
      scout: [
        { id: 'cron-s1', source: 'cron', last_active: nowSec - 700, input_tokens: 242_072, cache_read_tokens: 436_277, output_tokens: 23_898, estimated_cost_usd: 0.5751, model: 'gemini-4-hydrogen' },
      ],
      muse: [],
      forge: [],
    };

    const sessionInfoPayloads = {
      'bot-def': {
        model: 'gemini-4-neon',
        provider: 'gemini',
        started_at: nowSec - 86400 * 2,
        last_active_at: nowSec - 100,
        usage: { model: 'gemini-4-neon', input: 4_013_090, prompt: 19_831_233, output: 139_445, reasoning: 54_392 },
      },
      'bot-sct': {
        model: 'gemini-4-hydrogen',
        provider: 'gemini',
        started_at: nowSec - 86400 * 2,
        last_active_at: nowSec - 200,
        usage: { model: 'gemini-4-hydrogen', input: 202_334, prompt: 352_883, output: 9_990, reasoning: 5_160 },
      },
      'bot-mus': {
        model: 'gemini-4-neon',
        provider: 'gemini',
        started_at: nowSec - 86400 * 2,
        last_active_at: nowSec - 300,
        usage: { model: 'gemini-4-neon', input: 396_572, prompt: 1_515_112, output: 22_991, reasoning: 10_327 },
      },
      'bot-frg': {
        model: 'gemini-4-carbon',
        provider: 'gemini',
        started_at: nowSec - 86400 * 2,
        last_active_at: nowSec - 400,
        usage: { model: 'gemini-4-carbon', input: 114_458, prompt: 1_645_813, output: 20_143, reasoning: 11_021 },
      },
    };

    const cache = new Map();
    const allSessions = await collectProfileSessionsForScope({
      targetProfiles: ['default', 'forge', 'muse', 'scout'],
      connScopeKey: 'tailscale-lemini',
      effectiveConnId: 'tailscale-lemini',
      canonicalByProfile,
      botChatCache: cache,
      gwCallFn: async (_route, method, params) => {
        if (method === 'session.info') return sessionInfoPayloads[params.session_id];
        throw new Error('unexpected');
      },
      hostObj: {
        listPersistedSessions: async (_route, { profile }) => ({
          sessions: persistedByProfile[profile] || [],
        }),
      },
    });

    assert.equal(allSessions.length, 7); // 4 hidden Bot Chats + 2 default rows + 1 scout row

    // Focus on 总管 (default):
    const liveDef = mergeUsageSources(sessionInfoPayloads['bot-def'].usage, {}, {}, {});
    const aggWhenDefaultFocused = aggregatePersistedSessions(
      allSessions,
      'today',
      ['bot-def'],
      liveDef,
      'gemini-4-neon',
      nowMs,
      { __aggOpts: true, activeProfileSlug: 'default', connScopeKey: 'tailscale-lemini' }
    );

    // Focus on 情报官 (scout):
    const liveScout = mergeUsageSources(sessionInfoPayloads['bot-sct'].usage, {}, {}, {});
    const aggWhenScoutFocused = aggregatePersistedSessions(
      allSessions,
      'today',
      ['bot-sct'],
      liveScout,
      'gemini-4-hydrogen',
      nowMs,
      { __aggOpts: true, activeProfileSlug: 'scout', connScopeKey: 'tailscale-lemini' }
    );

    // Focus on 工程师 (forge):
    const liveForge = mergeUsageSources(sessionInfoPayloads['bot-frg'].usage, {}, {}, {});
    const aggWhenForgeFocused = aggregatePersistedSessions(
      allSessions,
      'today',
      ['bot-frg'],
      liveForge,
      'gemini-4-carbon',
      nowMs,
      { __aggOpts: true, activeProfileSlug: 'forge', connScopeKey: 'tailscale-lemini' }
    );

    // INVARIANT: All-Bots spend and token totals are 100% IDENTICAL across every focused bot!
    approxEqual(aggWhenDefaultFocused.costUsd, aggWhenScoutFocused.costUsd, 1e-6);
    approxEqual(aggWhenDefaultFocused.costUsd, aggWhenForgeFocused.costUsd, 1e-6);
    assert.equal(aggWhenDefaultFocused.total, aggWhenScoutFocused.total);
    assert.equal(aggWhenDefaultFocused.sessionCount, 7);
    // Expected total: 16.503666 + 0.389717 + 1.702362 + 1.166963 (Carbon $4/$20/$0.20) + 1.641824 + 0.3737 + 0.5751 ≈ $22.35
    approxEqual(aggWhenDefaultFocused.costUsd, 22.35333, 1e-4);
  });

  it('tracks daily ledger baselines so cross-day forever Bot Chats report exact daily deltas after day rollover', () => {
    const ctx = createMockCtx();
    const ledger = loadUsageLedger(ctx);
    const day1Ms = new Date(2026, 10, 26, 23, 0, 0).getTime();
    const day2Ms = new Date(2026, 10, 27, 10, 0, 0).getTime();
    const startedMs = new Date(2026, 10, 24, 20, 0, 0).getTime();

    // Day 1 end state: cumulative $10.00, 2M fresh in, 5M cacheRead, 100k out
    aggregatePersistedSessions(
      [
        {
          id: 'bot-def',
          _profile: 'default',
          started_at: startedMs,
          last_active: day1Ms,
          input_tokens: 2_000_000,
          cache_read_tokens: 5_000_000,
          output_tokens: 100_000,
          estimated_cost_usd: 10.0,
        },
      ],
      'today',
      [],
      null,
      '',
      day1Ms,
      { __aggOpts: true, activeProfileSlug: 'default', connScopeKey: 'local', ledger }
    );
    saveUsageLedger(ctx, ledger);

    // Day 2: cumulative grew to $16.50 -> 'today' reports ONLY Day 2's $6.50 delta, while 'all' reports $16.50!
    const reloaded = loadUsageLedger(ctx);
    const day2Today = aggregatePersistedSessions(
      [
        {
          id: 'bot-def',
          _profile: 'default',
          started_at: startedMs,
          last_active: day2Ms,
          input_tokens: 3_500_000,
          cache_read_tokens: 9_000_000,
          output_tokens: 150_000,
          estimated_cost_usd: 16.5,
        },
      ],
      'today',
      [],
      null,
      '',
      day2Ms,
      { __aggOpts: true, activeProfileSlug: 'default', connScopeKey: 'local', ledger: reloaded }
    );
    approxEqual(day2Today.costUsd, 6.5);
    assert.equal(day2Today.input, 1_500_000);
    assert.equal(day2Today.cacheRead, 4_000_000);
    assert.equal(day2Today.output, 50_000);

    const day2All = aggregatePersistedSessions(
      [
        {
          id: 'bot-def',
          _profile: 'default',
          started_at: startedMs,
          last_active: day2Ms,
          input_tokens: 3_500_000,
          cache_read_tokens: 9_000_000,
          output_tokens: 150_000,
          estimated_cost_usd: 16.5,
        },
      ],
      'all',
      [],
      null,
      '',
      day2Ms,
      { __aggOpts: true, activeProfileSlug: 'default', connScopeKey: 'local', ledger: reloaded }
    );
    approxEqual(day2All.costUsd, 16.5);
  });
});

describe('aggregatePersistedSessions', () => {
  // Use a local-timezone mid-month anchor so today/7d/month/all buckets are deterministic everywhere
  const nowMs = new Date(2026, 4, 15, 14, 30, 0, 0).getTime();
  const hour = 3600 * 1000;
  const day = 24 * hour;

  const sampleSessions = [
    {
      id: 's-today',
      last_active: nowMs - 2 * hour,
      input_tokens: 1000,
      output_tokens: 200,
      actual_cost_usd: 0.1,
      model: 'claude-sonnet-4',
    },
    // Duplicate entry for s-today should be ignored
    {
      session_id: 's-today',
      last_active: nowMs - hour,
      input_tokens: 9999,
      output_tokens: 9999,
      actual_cost_usd: 99,
    },
    {
      session_id: 's-3d',
      // Unix seconds timestamp
      started_at: Math.floor((nowMs - 3 * day) / 1000),
      input_tokens: 2000,
      output_tokens: 500,
      cost_usd: 0.2,
    },
    {
      id: 's-10d',
      // ISO string timestamp (May 5, inside month, outside 7d)
      last_active: new Date(nowMs - 10 * day).toISOString(),
      input_tokens: 4000,
      output_tokens: 1000,
      estimated_cost_usd: 0.4,
    },
    {
      id: 's-40d',
      // Previous month (April 5, only in 'all')
      last_active: nowMs - 40 * day,
      input_tokens: 8000,
      output_tokens: 2000,
      actual_cost_usd: 0.8,
    },
    // Malformed entries that must be skipped
    null,
    { id: '', last_active: nowMs, input_tokens: 500 },
    { id: 's-no-ts', input_tokens: 500, output_tokens: 500 },
  ];

  it('filters by time range (today, 7d, month, all) and deduplicates session IDs', () => {
    const today = aggregatePersistedSessions(sampleSessions, 'today', [], null, '', nowMs);
    assert.equal(today.sessionCount, 1);
    assert.equal(today.input, 1000);
    assert.equal(today.output, 200);
    assert.equal(today.total, 1200);
    approxEqual(today.costUsd, 0.1);
    assert.equal(today.estimated, false);

    const d7 = aggregatePersistedSessions(sampleSessions, '7d', [], null, '', nowMs);
    assert.equal(d7.sessionCount, 2);
    assert.equal(d7.input, 3000);
    assert.equal(d7.output, 700);
    approxEqual(d7.costUsd, 0.3);

    const month = aggregatePersistedSessions(sampleSessions, 'month', [], null, '', nowMs);
    assert.equal(month.sessionCount, 3);
    assert.equal(month.input, 7000);
    assert.equal(month.output, 1700);
    approxEqual(month.costUsd, 0.7);

    const all = aggregatePersistedSessions(sampleSessions, 'all', [], null, '', nowMs);
    // 'all' has cutoffMs === 0, so s-no-ts is also included
    assert.equal(all.sessionCount, 5);
    assert.equal(all.input, 15500);
    assert.equal(all.output, 4200);
    approxEqual(all.costUsd, 1.5);
  });

  it('deduplicates active session and applies Math.max protection against stale counters', () => {
    const sessions = [
      { id: 'active-1', last_active: nowMs - 1000, input_tokens: 5000, output_tokens: 1500, actual_cost_usd: 0.25 },
      { id: 'other-1', last_active: nowMs - 2000, input_tokens: 1000, output_tokens: 500, actual_cost_usd: 0.05 },
    ];

    // Live numbers higher on input/cost, persisted higher on output -> each takes max
    const liveMerged = { input: 8000, output: 1200, backendCost: 0.4 };
    const agg = aggregatePersistedSessions(sessions, 'today', ['active-1'], liveMerged, 'claude-sonnet-4', nowMs);

    assert.equal(agg.sessionCount, 2);
    assert.equal(agg.input, 9000);
    assert.equal(agg.output, 2000);
    assert.equal(agg.total, 11000);
    approxEqual(agg.costUsd, 0.45);
    assert.equal(agg.estimated, false);
  });

  it('appends an unpersisted active live session and estimates cost when backend cost is missing', () => {
    const sessions = [
      { id: 's-1', last_active: nowMs - 1000, input_tokens: 1_000_000, output_tokens: 0, model: 'claude-sonnet-4' },
    ];
    const liveMerged = {
      input: 1_000_000,
      output: 200_000,
      cacheRead: null,
      cacheHitPct: null,
      reasoning: 0,
      total: 1_200_000,
      backendCost: null,
    };

    const agg = aggregatePersistedSessions(sessions, 'today', ['unpersisted-live'], liveMerged, 'claude-sonnet-4', nowMs);
    assert.equal(agg.sessionCount, 2);
    assert.equal(agg.input, 2_000_000);
    assert.equal(agg.output, 200_000);
    // s-1: $3.0 + live: $6.0 = $9.0
    approxEqual(agg.costUsd, 9.0);
    assert.equal(agg.estimated, true);
  });

  it('returns costUsd = null when no session has backend or estimable cost', () => {
    const sessions = [{ id: 's-unknown', last_active: nowMs - 1000, input_tokens: 1000, output_tokens: 500 }];
    const agg = aggregatePersistedSessions(sessions, 'today', [], null, 'local-unknown-llm', nowMs);
    assert.equal(agg.sessionCount, 1);
    assert.equal(agg.costUsd, null);
    assert.equal(agg.estimated, false);
  });
});

describe('preferences, language & policy helpers', () => {
  it('sanitizePrefs keeps valid overrides, rejects bad values, and isolates DEFAULT_PREFS', () => {
    const defaults = sanitizePrefs(null);
    assert.deepEqual(defaults, DEFAULT_PREFS);
    assert.notEqual(defaults, DEFAULT_PREFS);
    assert.notEqual(defaults.fxRates, DEFAULT_PREFS.fxRates);

    const cleaned = sanitizePrefs({
      showBar: false,
      showPct: 'yes',
      usageScope: 'all',
      timeRange: '7d',
      tokenDisplay: 'invalid',
      currency: 'CNY',
      costPrecision: 3,
      language: 'zh',
      themeSkin: 'prism',
      barDensity: 'compact',
      breakdownScale: 'window',
      fxRates: {
        CNY: '7.1',
        EUR: -2,
        HKD: 0,
        JPY: Number.NaN,
        USD: Number.POSITIVE_INFINITY,
      },
    });

    assert.equal(cleaned.showBar, false);
    assert.equal(cleaned.showPct, DEFAULT_PREFS.showPct);
    assert.equal(cleaned.usageScope, 'all');
    assert.equal(cleaned.timeRange, '7d');
    assert.equal(cleaned.tokenDisplay, DEFAULT_PREFS.tokenDisplay);
    assert.equal(cleaned.currency, 'CNY');
    assert.equal(cleaned.costPrecision, '3');
    assert.equal(cleaned.language, 'zh');
    assert.equal(cleaned.themeSkin, 'prism');
    assert.equal(cleaned.barDensity, 'compact');
    assert.equal(cleaned.breakdownScale, 'window');
    assert.equal(cleaned.fxRates.CNY, 7.1);
    assert.equal(cleaned.fxRates.EUR, DEFAULT_PREFS.fxRates.EUR);
    assert.equal(cleaned.fxRates.HKD, DEFAULT_PREFS.fxRates.HKD);
    assert.equal(cleaned.fxRates.JPY, DEFAULT_PREFS.fxRates.JPY);
    assert.equal(cleaned.fxRates.USD, DEFAULT_PREFS.fxRates.USD);
  });

  it('loadPrefs and savePrefs read current key, migrate previous keys, and persist updates', () => {
    const ctx = createMockCtx();
    ctx.storage.set('prefs.v5', { currency: 'EUR', themeSkin: 'prism' });
    const migrated = loadPrefs(ctx);
    assert.equal(migrated.currency, 'EUR');
    assert.equal(migrated.themeSkin, 'prism');

    const next = { ...migrated, currency: 'JPY' };
    savePrefs(ctx, next);
    assert.equal(ctx.storage.get(STORAGE_KEY).currency, 'JPY');
    assert.equal(loadPrefs(ctx).currency, 'JPY');
  });

  it('resolveLang honors explicit override, ctx locale, document lang, navigator language, and fallback', () => {
    assert.equal(resolveLang('zh', null), 'zh');
    assert.equal(resolveLang('en', null), 'en');

    assert.equal(resolveLang('auto', { i18n: { locale: { get: () => 'zh-CN' } } }), 'zh');
    assert.equal(resolveLang('auto', { i18n: { locale: 'en-US' } }), 'en');

    // Throwing getter falls through to document.documentElement.lang
    const throwingCtx = {
      i18n: {
        locale: {
          get() {
            throw new Error('boom');
          },
        },
      },
    };
    withGlobalOverride('document', createMockDocument('zh-TW'), () => {
      assert.equal(resolveLang('auto', throwingCtx), 'zh');
    });

    // Empty document + navigator fallback
    withGlobalOverride('document', createMockDocument(''), () => {
      withGlobalOverride('navigator', { language: 'zh-Hans' }, () => {
        assert.equal(resolveLang('auto', null), 'zh');
      });
      withGlobalOverride('navigator', { language: 'ja-JP' }, () => {
        assert.equal(resolveLang('auto', null), 'en');
      });
      withGlobalOverride('navigator', undefined, () => {
        assert.equal(resolveLang('auto', null), 'en');
      });
    });
  });

  it('extractContextPolicy parses full config and defaults safely for missing/partial input', () => {
    const full = extractContextPolicy({
      compression: {
        enabled: false,
        threshold: 65,
        target_ratio: '0.4',
        protect_last_n: 6,
      },
      context: { engine: 'sliding-window' },
      memory: {
        memory_enabled: false,
        user_profile_enabled: true,
        memory_char_limit: 8000,
        user_char_limit: 2000,
      },
    });
    assert.deepEqual(full, {
      enabled: false,
      threshold: 0.65,
      targetRatio: 0.4,
      protectLastN: 6,
      contextEngine: 'sliding-window',
      memoryEnabled: false,
      userProfileEnabled: true,
      memoryCharLimit: 8000,
      userCharLimit: 2000,
    });

    const empty = extractContextPolicy(null);
    assert.deepEqual(empty, {
      enabled: true,
      threshold: null,
      targetRatio: null,
      protectLastN: null,
      contextEngine: '',
      memoryEnabled: true,
      userProfileEnabled: true,
      memoryCharLimit: null,
      userCharLimit: null,
    });
  });

  it('buildConfigGetParams and readPolicyViaSdk read config strictly via SDK RPC with safe fallbacks', async () => {
    assert.deepEqual(buildConfigGetParams(null, 'default', 'full'), { key: 'full' });
    assert.deepEqual(buildConfigGetParams(null, 'coder', 'full'), { key: 'full', profile: 'coder' });
    assert.deepEqual(
      buildConfigGetParams({ connectionId: 'local', profile: 'coder', targetProfile: 'coder' }, 'coder', 'full'),
      { key: 'full' }
    );

    // 1) When config.get(full) includes compression/memory, no fallback section calls are needed
    const fullCalls = [];
    const fullResult = await readPolicyViaSdk(
      { connectionId: 'local', mode: 'local', profile: 'forge', targetProfile: 'forge' },
      'forge',
      async (_route, method, params) => {
        fullCalls.push({ method, params });
        if (params.key === 'full') {
          return {
            config: {
              compression: { enabled: true, threshold: 0.65, target_ratio: 0.25, protect_last_n: 12 },
              context: { engine: 'compressor' },
              memory: { memory_enabled: true, user_profile_enabled: false, memory_char_limit: 4000 },
              model: { provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
            },
          };
        }
        if (params.key === 'provider') {
          return { provider: 'anthropic' };
        }
        throw new Error(`unexpected key: ${params.key}`);
      }
    );
    assert.equal(fullCalls.length, 2);
    assert.deepEqual(fullResult.policy, {
      enabled: true,
      threshold: 0.65,
      targetRatio: 0.25,
      protectLastN: 12,
      contextEngine: 'compressor',
      memoryEnabled: true,
      userProfileEnabled: false,
      memoryCharLimit: 4000,
      userCharLimit: null,
    });
    assert.deepEqual(fullResult.routeHint, {
      provider: 'anthropic',
      base_url: 'https://openrouter.ai/api/v1',
    });

    // 2) When config.get(full) only returns display.* and unknown keys reject, readPolicyViaSdk recovers cleanly
    const partialResult = await readPolicyViaSdk(null, 'coder', async (_route, _method, params) => {
      if (params.key === 'full') return { config: { display: { compact: false } } };
      if (params.key === 'provider') return { provider: 'openai-codex' };
      if (params.key === 'compression.threshold') return { key: 'compression.threshold', value: 0.75 };
      if (params.key === 'compression.enabled') return { key: 'compression.enabled', value: 'on' };
      throw new Error(`unknown config key: ${params.key}`);
    });
    assert.equal(partialResult.policy.enabled, true);
    assert.equal(partialResult.policy.threshold, 0.75);
    assert.equal(partialResult.policy.memoryEnabled, true);
    assert.deepEqual(partialResult.routeHint, { provider: 'openai-codex', base_url: '' });

    // 3) mergeSdkConfigResponses handles null/empty payloads safely
    const emptyMerged = mergeSdkConfigResponses(null, null, {});
    assert.equal(emptyMerged.policy.enabled, true);
    assert.equal(emptyMerged.policy.threshold, null);
    assert.deepEqual(emptyMerged.routeHint, { provider: '', base_url: '' });
  });

  it('ConfigPanel Policy tab renders strictly read-only overview and Open Settings action without raw bridge', () => {
    const pluginSource = readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8');
    assert.equal(pluginSource.includes('hermesDesktop'), false, 'desktop/plugin.js must not reference hermesDesktop');
    assert.equal(pluginSource.includes('/api/config'), false, 'desktop/plugin.js must not call /api/config directly');

    function collectNodes(node, pred, acc = []) {
      if (!node || typeof node !== 'object') return acc;
      if (Array.isArray(node)) {
        for (const item of node) collectNodes(item, pred, acc);
        return acc;
      }
      if (pred(node)) acc.push(node);
      if (Array.isArray(node.children)) {
        for (const child of node.children) collectNodes(child, pred, acc);
      }
      return acc;
    }

    function collectText(node) {
      if (node == null || typeof node === 'boolean') return '';
      if (typeof node === 'string' || typeof node === 'number') return String(node);
      if (Array.isArray(node)) return node.map(collectText).join(' ');
      if (typeof node === 'object' && Array.isArray(node.children)) {
        return node.children.map(collectText).join(' ');
      }
      return '';
    }

    const actions = [];
    let closedCount = 0;
    const tree = ConfigPanel({
      ctx: {
        runAction(id) {
          actions.push(id);
          return { ok: true };
        },
      },
      t: I18N.en,
      prefs: DEFAULT_PREFS,
      onPatch: () => {},
      onReset: () => {},
      onBack: () => {},
      onClose: () => {
        closedCount += 1;
      },
      botName: 'Forge',
      profileCount: 2,
      initialTab: 'policy',
      policy: {
        enabled: true,
        threshold: 0.65,
        targetRatio: null,
        protectLastN: 16,
        contextEngine: 'compressor',
        memoryEnabled: true,
        userProfileEnabled: true,
        memoryCharLimit: null,
        userCharLimit: 1800,
      },
    });

    const text = collectText(tree);
    assert.match(text, /Read-only/);
    assert.match(text, /65%/);
    assert.match(text, /20% \(default\)/);
    assert.match(text, /16 msgs/);
    assert.match(text, /2,200 chars \(default\)/);
    assert.match(text, /Open Settings/);

    // Policy tab must not render interactive form inputs or toggle switches
    const inputs = collectNodes(tree, (n) => n.type === 'input');
    const switches = collectNodes(tree, (n) => n.props?.role === 'switch');
    assert.equal(inputs.length, 0);
    assert.equal(switches.length, 0);

    // Open Settings CTA triggers SDK nav.settings action and closes popover
    const ctaButtons = collectNodes(tree, (n) => n.type === 'button' && n.props?.className === 'lub-settings-cta');
    assert.equal(ctaButtons.length, 1);
    ctaButtons[0].props.onClick();
    assert.deepEqual(actions, ['nav.settings']);
    assert.equal(closedCount, 1);

    // Fallback to host.navigate('/settings') when ctx.runAction is absent
    const navPaths = [];
    const prevNavigate = host.navigate;
    try {
      host.navigate = (p) => navPaths.push(p);
      const zhTree = ConfigPanel({
        ctx: {},
        t: I18N.zh,
        prefs: DEFAULT_PREFS,
        onPatch: () => {},
        onReset: () => {},
        onBack: () => {},
        onClose: () => {
          closedCount += 1;
        },
        botName: '工程师',
        profileCount: 1,
        initialTab: 'policy',
        policy: extractContextPolicy(null),
      });
      const zhText = collectText(zhTree);
      assert.match(zhText, /只读/);
      assert.match(zhText, /打开官方设置页/);
      const zhCta = collectNodes(zhTree, (n) => n.type === 'button' && n.props?.className === 'lub-settings-cta');
      assert.equal(zhCta.length, 1);
      zhCta[0].props.onClick();
      assert.deepEqual(navPaths, ['/settings']);
      assert.equal(closedCount, 2);
    } finally {
      host.navigate = prevNavigate;
    }
  });
});

describe('formatting, estimation, threshold & tone utilities', () => {
  it('fmtCompact formats numbers, delegates to SDK compactNumber, and recovers if SDK throws', () => {
    assert.equal(fmtCompact(null), '—');
    assert.equal(fmtCompact(undefined), '—');
    assert.equal(fmtCompact(0), '0');
    assert.equal(fmtCompact(999), '999');
    assert.equal(fmtCompact(1500), '1.5k');
    assert.equal(fmtCompact(125000), '125k');
    assert.equal(fmtCompact(2_500_000), '2.50M');

    try {
      __setCompactNumber((n) => `sdk:${n}`);
      assert.equal(fmtCompact(1500), 'sdk:1500');

      __setCompactNumber(() => {
        throw new Error('sdk failure');
      });
      assert.equal(fmtCompact(1500), '1.5k');
    } finally {
      __setCompactNumber(undefined);
    }
  });

  it('fmtCurrency handles currencies, precision modes, tiny values, estimated prefix, and fallback fxRates', () => {
    const usdAuto = { ...DEFAULT_PREFS, currency: 'USD', costPrecision: 'auto' };
    assert.equal(fmtCurrency(null, false, usdAuto), '—');
    assert.equal(fmtCurrency(undefined, true, usdAuto), '—');
    assert.equal(fmtCurrency(0, false, usdAuto), '$0.00');
    assert.equal(fmtCurrency(0, true, usdAuto), '~$0.00');
    assert.equal(fmtCurrency(0.0004, false, usdAuto), '$<0.001');
    assert.equal(fmtCurrency(0.045, true, usdAuto), '~$0.045');
    assert.equal(fmtCurrency(1.234, false, usdAuto), '$1.23');

    assert.equal(fmtCurrency(0.0004, false, { ...usdAuto, costPrecision: '2' }), '$0.00');
    assert.equal(fmtCurrency(1.234, false, { ...usdAuto, costPrecision: '3' }), '$1.234');

    const cny = { ...DEFAULT_PREFS, currency: 'CNY', fxRates: { CNY: 7.2 }, costPrecision: 'auto' };
    assert.equal(fmtCurrency(1, false, cny), '¥7.20');

    // Invalid fxRate falls back to CURRENCY_META defaultRate (7.25)
    const cnyBadRate = { ...DEFAULT_PREFS, currency: 'CNY', fxRates: { CNY: Number.NaN }, costPrecision: '2' };
    assert.equal(fmtCurrency(1, false, cnyBadRate), '¥7.25');

    // JPY uses 2 decimals below 1 and rounded integer with grouping at/above 1
    const jpy = { ...DEFAULT_PREFS, currency: 'JPY', fxRates: { JPY: 150 } };
    assert.equal(fmtCurrency(0.005, false, jpy), '¥0.75');
    assert.equal(fmtCurrency(10, true, jpy), '~¥1,500');

    // Unknown currency falls back to USD symbol and defaultRate=1
    assert.equal(fmtCurrency(2, false, { ...DEFAULT_PREFS, currency: 'XYZ' }), '$2.00');
  });

  it('estimateChunkTokens estimates CJK, Latin, mixed text, and invalid inputs', () => {
    assert.equal(estimateChunkTokens(''), 0);
    assert.equal(estimateChunkTokens(null), 0);
    assert.equal(estimateChunkTokens(undefined), 0);
    assert.equal(estimateChunkTokens(123), 0);
    approxEqual(estimateChunkTokens('hello'), 5 * 0.26);
    approxEqual(estimateChunkTokens('你好世界'), 4 * 0.65);
    approxEqual(estimateChunkTokens('Hi你好'), 2 * 0.26 + 2 * 0.65);
  });

  it('normalizeThreshold normalizes ratios/percentages and rejects invalid boundaries', () => {
    approxEqual(normalizeThreshold(0.5), 0.5);
    approxEqual(normalizeThreshold(1), 1);
    approxEqual(normalizeThreshold(65), 0.65);
    approxEqual(normalizeThreshold(100), 1);
    approxEqual(normalizeThreshold('75'), 0.75);
    approxEqual(normalizeThreshold('0.85'), 0.85);

    for (const bad of [0, -0.5, -10, 100.1, 200, Number.NaN, Number.POSITIVE_INFINITY, null, undefined, '', 'abc']) {
      assert.equal(normalizeThreshold(bad), null, `expected null for ${String(bad)}`);
    }
  });

  it('resolveToneLevel classifies normal, warn, and danger across trigger ratios and edge inputs', () => {
    assert.equal(resolveToneLevel(null, 0.5), 'normal');
    assert.equal(resolveToneLevel(undefined, 0.5), 'normal');
    assert.equal(resolveToneLevel(0.2, 0.5), 'normal');
    // Relative pressure: 0.36 / 0.5 = 0.72 -> warn; 0.46 / 0.5 = 0.92 -> danger
    assert.equal(resolveToneLevel(0.36, 0.5), 'warn');
    assert.equal(resolveToneLevel(0.46, 0.5), 'danger');
    // Absolute floors still escalate even with high triggerRatio = 1.0
    assert.equal(resolveToneLevel(0.65, 1.0), 'warn');
    assert.equal(resolveToneLevel(0.85, 1.0), 'danger');
    // Missing/zero triggerRatio defaults to 0.85
    assert.equal(resolveToneLevel(0.62, 0), 'warn');
    assert.equal(resolveToneLevel(0.79, null), 'danger');
  });

  it('covers auxiliary pure utilities (fmtFull, fmtPct, fmtTps, toNum, toEpochMs, pickBestNum, resolveModelName, categories, route, scopeLabel)', () => {
    assert.equal(fmtFull(null), '—');
    assert.equal(fmtFull(12345.6), '12,346');

    assert.equal(fmtPct(null), '—');
    assert.equal(fmtPct(Number.NaN), '—');
    assert.equal(fmtPct(0.0005), '<0.1%');
    assert.equal(fmtPct(0.052), '5.2%');
    assert.equal(fmtPct(0.256), '26%');

    assert.equal(fmtTps(null), null);
    assert.equal(fmtTps(0), null);
    assert.equal(fmtTps(-5), null);
    assert.equal(fmtTps(Number.NaN), null);
    assert.equal(fmtTps(42.34), '42.3');
    assert.equal(fmtTps(120.7), '121');

    assert.equal(toNum(42), 42);
    assert.equal(toNum(Number.NaN), null);
    assert.equal(toNum(Number.POSITIVE_INFINITY), null);
    assert.equal(toNum('42'), null);

    assert.equal(toEpochMs(null), null);
    assert.equal(toEpochMs(-10), null);
    assert.equal(toEpochMs(1_700_000_000), 1_700_000_000_000);
    assert.equal(toEpochMs(1_700_000_000_123), 1_700_000_000_123);
    assert.equal(toEpochMs('1700000000'), 1_700_000_000_000);
    assert.equal(toEpochMs('not-a-date'), null);

    assert.equal(getTimeRangeCutoffMs('all', 123456), 0);
    assert.equal(getTimeRangeCutoffMs('unknown', 123456), 0);

    assert.equal(pickBestNum(null, 0, 5, 10), 5);
    assert.equal(pickBestNum(null, 0, -1), 0);
    assert.equal(pickBestNum(null, Number.NaN, undefined), null);

    assert.equal(resolveModelName({ model: 'live-m' }, { model: 'rpc-m' }, { model: 'ps-m' }, 'state-m'), 'rpc-m');
    assert.equal(resolveModelName({}, {}, {}, { id: 'obj-model' }), 'obj-model');
    assert.equal(resolveModelName(null, null, null, null), '');

    const cats = normalizeCategories(
      {
        categories: [
          { id: 'memory', tokens: 200 },
          { id: 'zero', tokens: 0 },
          { id: 'conversation', tokens: 1000 },
        ],
      },
      'prism',
      I18N.en
    );
    assert.equal(cats.length, 2);
    assert.equal(cats[0].id, 'conversation');
    assert.equal(cats[0].opacity, 1);
    assert.equal(cats[1].id, 'memory');

    assert.equal(resolveRoute(null, 'default'), null);
    assert.deepEqual(resolveRoute({ connectionId: 'local', profile: 'work' }, 'fallback'), {
      connectionId: 'local',
      mode: 'local',
      profile: 'work',
      targetProfile: 'work',
    });
    assert.equal(resolveRoute({ connectionId: 'tailscale-1' }, 'ops').mode, 'remote');

    const sessionLabel = buildScopeLabel({ usageScope: 'session', timeRange: 'today' }, 'Hermes', 2, I18N.en);
    assert.equal(sessionLabel.chipPrefix, '');
    const allLabel = buildScopeLabel({ usageScope: 'all', timeRange: '7d' }, 'Hermes', 3, I18N.en);
    assert.match(allLabel.pill, /3/);
    assert.ok(allLabel.chipPrefix.includes('7d'));
  });
});

describe('v1.0.2 auditor hardening & ledger API dual-engine suite', () => {
  it('handles 0% and 100% cache-hit tui_usage, nested token details, and single-bucket selection without double-counting', () => {
    // 0% cache hit (`input === prompt`, `cache_hit_pct: 0`): pins cacheRead = 0 so stale cacheHitPct never re-splits input
    const zeroHit = extractSourceTokenBuckets({ input: 50_000, prompt: 50_000, cache_hit_pct: 0 });
    assert.equal(zeroHit.input, 50_000);
    assert.equal(zeroHit.cacheRead, 0);
    assert.equal(zeroHit.promptTokens, 50_000);
    // Even if an external stale cacheHitPct=80 is passed, explicit cacheRead=0 prevents re-splitting!
    approxEqual(estimateRawTokensUsd(zeroHit.input, 0, 'gemini-4-neon', zeroHit.cacheRead, 80), 0.15);

    // 100% cache hit (`input === prompt`, `cache_hit_pct: 100`): shifts bucket to cacheRead
    const fullHit = extractSourceTokenBuckets({ input: 50_000, prompt: 50_000, cache_hit_pct: 100 });
    assert.equal(fullHit.input, 0);
    assert.equal(fullHit.cacheRead, 50_000);
    assert.equal(fullHit.promptTokens, 50_000);

    // Nested OpenAI / Anthropic details objects
    const nested = extractSourceTokenBuckets({
      prompt_tokens: 100_000,
      prompt_tokens_details: { cached_tokens: 70_000, cache_creation_tokens: 10_000 },
    });
    assert.equal(nested.input, 20_000);
    assert.equal(nested.cacheRead, 70_000);
    assert.equal(nested.cacheWrite, 10_000);
    assert.equal(nested.promptTokens, 100_000);

    // Cross-source safety: RPC has OpenAI shape (`prompt_tokens: 100k`, no cache field yet -> input=100k),
    // while persisted row for the SAME turn has `input_tokens: 20k, cache_read_tokens: 80k` (prompt=100k).
    // `mergeUsageSources` must pick the richer 100k bucket cleanly (20k + 80k = 100k), NOT 100k + 80k = 180k!
    const crossMerged = mergeUsageSources(
      {},
      { prompt_tokens: 100_000, completion_tokens: 5_000 },
      { input_tokens: 20_000, cache_read_tokens: 80_000, output_tokens: 5_000 },
      {}
    );
    assert.equal(crossMerged.input, 20_000);
    assert.equal(crossMerged.cacheRead, 80_000);
    assert.equal(crossMerged.promptTokens, 100_000);
  });

  it('evaluates >200k tiered pricing per-call (promptTotal / calls) and covers gemini-3.1-pro & gpt-6 tiers', () => {
    // Gemini 3.1 Pro: <=200k ($2/$12/$0.2), >200k ($4/$18/$0.4)
    // Cumulative 300k across 6 API calls -> 50k/call -> base tier ($2/M * 0.3M = $0.60)
    approxEqual(estimateRawTokensUsd(300_000, 0, 'gemini-3.1-pro', 0, null, 0, null, Date.now(), 0, 6), 0.6);
    // Single call of 300k -> >200k tier ($4/M * 0.3M = $1.20)
    approxEqual(estimateRawTokensUsd(300_000, 0, 'gemini-3.1-pro', 0, null, 0, null, Date.now(), 0, 1), 1.2);

    // GPT-6 series pay-as-you-go fallback rates (aligned with Hermes `agent/usage_pricing.py`)
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gpt-6.2-astra'), 48.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gpt-6-astra'), 60.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gpt-6.2-sol'), 12.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gpt-6-luna'), 0.6);
  });

  it('prevents double-counting compressed ancestor segments when focusing a rotated child session (`parent_session_id`)', () => {
    const nowMs = Date.UTC(2026, 10, 27, 15, 0, 0);
    // Parent S1 ($1.00) rotated via compression to child S2 ($0.20 persisted + $0.05 unsaved live delta = $1.25 full chain in memory)
    const ledgerRows = [
      {
        id: 'S1',
        _profile: 'default',
        end_reason: 'compression',
        started_at: nowMs - 7200_000,
        last_active: nowMs - 3600_000,
        input_tokens: 200_000,
        output_tokens: 26_666,
        estimated_cost_usd: 1.0,
        model: 'gemini-4-neon',
      },
      {
        id: 'S2',
        _profile: 'default',
        parent_session_id: 'S1',
        started_at: nowMs - 3600_000,
        last_active: nowMs - 60_000,
        input_tokens: 40_000,
        output_tokens: 5_333,
        estimated_cost_usd: 0.2,
        model: 'gemini-4-neon',
      },
      {
        id: 'bot-sct',
        _profile: 'scout',
        started_at: nowMs - 1800_000,
        last_active: nowMs - 30_000,
        input_tokens: 100_000,
        output_tokens: 20_000,
        estimated_cost_usd: 0.3,
        model: 'gemini-4-hydrogen',
      },
    ];

    // Live runtime memory on `default` holds the FULL chain sum (S1 + S2 + $0.05 unsaved = $1.25, 250k in, 34k out)
    const fullChainLiveDefault = {
      input: 250_000,
      cacheRead: 0,
      cacheWrite: 0,
      output: 34_000,
      backendCost: 1.25,
    };

    const aggFocusedDefault = aggregatePersistedSessions(
      ledgerRows,
      'today',
      ['S2'],
      fullChainLiveDefault,
      'gemini-4-neon',
      nowMs,
      { __aggOpts: true, activeProfileSlug: 'default', connScopeKey: 'local', mutateLedger: false }
    );
    // Must equal S1 ($1.00) + S2 ($0.25 net) + scout ($0.30) = $1.55 (NEVER $1.00 + $1.25 + $0.30 = $2.55!)
    approxEqual(aggFocusedDefault.costUsd, 1.55);
    assert.equal(aggFocusedDefault.input, 350_000);

    // Once S2 persists $0.25 to DB and user clicks `scout`, All-Bots spend stays $1.55 identically!
    ledgerRows[1] = { ...ledgerRows[1], input_tokens: 50_000, output_tokens: 7_334, estimated_cost_usd: 0.25 };
    const aggFocusedScout = aggregatePersistedSessions(
      ledgerRows,
      'today',
      ['bot-sct'],
      { input: 100_000, output: 20_000, backendCost: 0.3 },
      'gemini-4-hydrogen',
      nowMs,
      { __aggOpts: true, activeProfileSlug: 'scout', connScopeKey: 'local', mutateLedger: false }
    );
    approxEqual(aggFocusedScout.costUsd, 1.55);
  });

  it('keeps aggregatePersistedSessions pure when mutateLedger=false, anchors dormant sessions before cutoff, gates unaligned live _sid, and counts _is_aux cost without inflating sessionCount', () => {
    const ledger = {};
    const day2Ms = new Date(2026, 10, 27, 12, 0, 0).getTime();
    const day1Ms = new Date(2026, 10, 26, 18, 0, 0).getTime();

    const rows = [
      // Dormant session from yesterday: excluded from 'today' spend, yet MUST still emit an observation!
      {
        id: 'dormant-1',
        _profile: 'muse',
        started_at: day1Ms - 3600_000,
        last_active: day1Ms,
        input_tokens: 500_000,
        output_tokens: 50_000,
        estimated_cost_usd: 2.25,
      },
      // Active session today on scout
      {
        id: 'bot-sct',
        _profile: 'scout',
        started_at: day2Ms - 1000,
        last_active: day2Ms,
        input_tokens: 100_000,
        output_tokens: 10_000,
        estimated_cost_usd: 0.225,
      },
      // Auxiliary task row (e.g. background_review): adds to spend & tokens, NOT to sessionCount
      {
        id: 'aux:bot-sct:background_review:gemini-4-hydrogen:gemini',
        _is_aux: true,
        _profile: 'scout',
        started_at: day2Ms - 500,
        last_active: day2Ms,
        input_tokens: 20_000,
        output_tokens: 2_000,
        estimated_cost_usd: 0.045,
      },
    ];

    // Stale liveMerged from previous bot (`liveSidAligned: false`) MUST NOT pollute `bot-sct`!
    const staleHeavyLive = { input: 9_000_000, cacheRead: 15_000_000, output: 500_000, backendCost: 25.0 };
    const agg = aggregatePersistedSessions(rows, 'today', ['bot-sct'], staleHeavyLive, 'gemini-4-hydrogen', day2Ms, {
      __aggOpts: true,
      activeProfileSlug: 'scout',
      connScopeKey: 'tailscale-lemini',
      ledger,
      mutateLedger: false,
      liveSidAligned: false,
    });

    // Pure render check: `ledger` was NOT mutated in place
    assert.deepEqual(ledger, {});
    // Dormant session + active session + aux row all emitted observations (3 total)
    assert.equal(agg.observations.length, 3);
    // Only non-aux active session counted in `sessionCount` (1), while spend includes aux ($0.225 + $0.045 = $0.27)
    assert.equal(agg.sessionCount, 1);
    approxEqual(agg.costUsd, 0.27);
  });

  it('prevents gwCall from replaying remote or JSON-RPC errors onto the local active socket', async () => {
    let localSocketCalled = false;
    const mockHost = {
      state: {
        profile: { get: () => 'default' },
        connectionId: { get: () => 'local' },
      },
      requestProfile: async () => {
        const rpcErr = new Error('Method not found');
        rpcErr.code = -32601;
        throw rpcErr;
      },
      request: async () => {
        localSocketCalled = true;
        return { ok: true };
      },
    };

    // 1. JSON-RPC error on same profile/connection must throw, never replay via `request`
    await assert.rejects(
      () => gwCall({ connectionId: 'local', mode: 'local', profile: 'default', targetProfile: 'default' }, 'session.info', {}, 'default', mockHost),
      /Method not found/
    );
    assert.equal(localSocketCalled, false);

    // 2. Transport error on a DIFFERENT connection ('tailscale-remote' vs 'local') with same profile 'default' must throw!
    const mockHostCrossConn = {
      ...mockHost,
      requestProfile: async () => {
        throw new Error('Remote tunnel timeout');
      },
    };
    await assert.rejects(
      () => gwCall({ connectionId: 'tailscale-remote', mode: 'remote', profile: 'default', targetProfile: 'default' }, 'session.compress', {}, 'default', mockHostCrossConn),
      /Remote tunnel timeout/
    );
    assert.equal(localSocketCalled, false);
  });

  it('fetches authoritative backend /ledger via ctx.rest and degrades cleanly to null when absent', async () => {
    assert.equal(await fetchBackendLedger({}), null);
    assert.equal(
      await fetchBackendLedger({
        rest: async () => {
          throw new Error('404 Not Found');
        },
      }),
      null
    );

    const okLedger = await fetchBackendLedger({
      rest: async (path) => {
        assert.equal(path, '/ledger');
        return {
          ok: true,
          profiles: [
            { name: 'default', title: '总管', model: 'gemini-4-neon', provider: 'gemini' },
            { name: 'scout', title: '情报官', model: 'gemini-4-hydrogen', provider: 'gemini' },
          ],
          entries: [{ id: 's1', _profile: 'default', input_tokens: 1000, estimated_cost_usd: 0.05 }],
        };
      },
    });
    assert.ok(okLedger);
    assert.deepEqual(okLedger.names, ['default', 'scout']);
    assert.equal(okLedger.titles.default, '总管');
    assert.equal(okLedger.entries.length, 1);

    // Async storage safety: Promise-like return values from custom storage adapters do not crash loadPrefs / loadUsageLedger
    const asyncCtx = { storage: { get: () => Promise.resolve({ showBar: false }) } };
    assert.equal(loadPrefs(asyncCtx).showBar, true);
    assert.deepEqual(loadUsageLedger(asyncCtx), {});

    // Focused cold-reload session backfill from `/ledger` (including compressed ancestor chain summation)
    const focusedChain = extractFocusedSessionFromLedger(
      [
        { id: 'S1', _profile: 'default', end_reason: 'compression', input_tokens: 1_000_000, cache_read_tokens: 2_000_000, output_tokens: 50_000, estimated_cost_usd: 4.05 },
        { id: 'S2', _profile: 'default', parent_session_id: 'S1', input_tokens: 200_000, cache_read_tokens: 500_000, output_tokens: 10_000, estimated_cost_usd: 0.825 },
        { id: 'aux:S2:vision:m:g', _profile: 'default', _is_aux: true, input_tokens: 999999, estimated_cost_usd: 99 },
      ],
      ['S2'],
      'default'
    );
    assert.ok(focusedChain);
    assert.equal(focusedChain.input_tokens, 1_200_000);
    assert.equal(focusedChain.cache_read_tokens, 2_500_000);
    assert.equal(focusedChain.output_tokens, 60_000);
    assert.equal(focusedChain.compression_count, 1);
    approxEqual(focusedChain.estimated_cost_usd, 4.875);
  });
});
