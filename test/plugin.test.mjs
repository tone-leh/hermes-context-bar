import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STATUSBAR_AREAS, __setCompactNumber } from '@hermes/plugin-sdk';
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
  buildApiScope,
  extractContextPolicy,
  readSchemaChoices,
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
  estimateRawTokensUsd,
  mergeUsageSources,
  estimateSessionCost,
  aggregatePersistedSessions,
  normalizeCategories,
  resolveRoute,
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
      const merged = mergeUsageSources({ input: 10000, ...cacheObj }, {}, {}, {});
      assert.equal(merged.cacheRead, 8000);
      assert.equal(merged.cacheHitPct, 80);
    }

    // Also reads cache fields from rpcUsage and persistedSession
    const fromRpc = mergeUsageSources({}, { prompt_tokens: 20000, cached_input_tokens: 5000 }, {}, {});
    assert.equal(fromRpc.cacheRead, 5000);
    assert.equal(fromRpc.cacheHitPct, 25);

    const fromPersisted = mergeUsageSources({}, {}, { input_tokens: 4000, cache_read_tokens: 3000 }, {});
    assert.equal(fromPersisted.cacheRead, 3000);
    assert.equal(fromPersisted.cacheHitPct, 75);
  });

  it('prefers positive direct cacheHitPct, falls back to derived when direct is 0, and caps at 100', () => {
    const directWins = mergeUsageSources({ input: 10000, cache_read_tokens: 5000, cache_hit_pct: 62 }, {}, {}, {});
    assert.equal(directWins.cacheHitPct, 62);

    const zeroFallsBackToDerived = mergeUsageSources(
      { input: 10000, cache_read_tokens: 7500, cache_hit_pct: 0 },
      {},
      {},
      {}
    );
    assert.equal(zeroFallsBackToDerived.cacheHitPct, 75);

    const zeroWithoutCacheRead = mergeUsageSources({ input: 10000, cache_hit_pct: 0 }, {}, {}, {});
    assert.equal(zeroWithoutCacheRead.cacheHitPct, 0);

    const capped = mergeUsageSources({ input: 1000, cacheRead: 2500 }, {}, {}, {});
    assert.equal(capped.cacheHitPct, 100);
  });

  it('handles null, undefined, and non-object inputs gracefully', () => {
    const empty = mergeUsageSources(null, undefined, 'invalid', 42);
    assert.deepEqual(empty, {
      input: null,
      output: null,
      reasoning: null,
      total: null,
      calls: null,
      ctxUsed: null,
      ctxMax: null,
      ctxPct: null,
      cacheRead: null,
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

    // Gemini 4 Carbon: $2/$10/$0.10 intro through Nov 30, 2026; $4/$20/$0.20 from Dec 1, 2026
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-carbon', null, null, 0, null, nov2026), 12.0);
    approxEqual(estimateRawTokensUsd(1_000_000, 1_000_000, 'gemini-4-carbon', 500_000, null, 0, null, dec2026), 22.1);
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

  it('applies cache discounts using cacheRead or cacheHitPct without negative fresh input', () => {
    // Claude Sonnet: [3.0, 15.0, 0.3]
    // 800k cached + 200k fresh + 200k out = 0.24 + 0.60 + 3.00 = 3.84
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', 800_000), 3.84);

    // cacheRead exceeding input is clamped to input (no negative fresh tokens)
    approxEqual(estimateRawTokensUsd(1_000_000, 200_000, 'claude-sonnet-4', 1_500_000), 3.3);

    // cacheHitPct fallback when cacheRead is null
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
      { backendCost: null, input: 1_000_000, output: 0, cacheRead: 500_000, cacheHitPct: null, reasoning: 0, total: 1_000_000 },
      'claude-sonnet-4'
    );
    assert.equal(est.estimated, true);
    approxEqual(est.amount, 1.65);

    assert.deepEqual(
      estimateSessionCost({ backendCost: null, input: 1000, output: 500 }, 'unknown-model'),
      { amount: null, estimated: true }
    );
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

  it('readSchemaChoices and buildApiScope handle valid and edge inputs', () => {
    assert.deepEqual(readSchemaChoices({ fields: { k: { enum: ['a', '', 'b'] } } }, 'k'), ['a', 'b']);
    assert.deepEqual(readSchemaChoices({ fields: { k: { choices: [1, 2] } } }, 'k'), ['1', '2']);
    assert.deepEqual(readSchemaChoices({ fields: { k: { options: ['x'] } } }, 'k'), ['x']);
    assert.deepEqual(readSchemaChoices(null, 'k'), []);

    assert.deepEqual(buildApiScope('', ''), { priority: 'foreground' });
    assert.deepEqual(buildApiScope('remote-1', 'coder'), {
      priority: 'foreground',
      connectionId: 'remote-1',
      profile: 'coder',
    });
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
