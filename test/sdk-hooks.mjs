import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const VIRTUAL_REACT = 'virtual:hermes-test-react';
const VIRTUAL_SDK = 'virtual:hermes-test-plugin-sdk';

const REACT_STUB = `
const React = {
  Fragment: Symbol.for('react.fragment'),
  createElement(type, props, ...children) {
    return { type, props: props ?? {}, children };
  },
  useState(initial) {
    const val = typeof initial === 'function' ? initial() : initial;
    return [val, () => {}];
  },
  useEffect() {},
  useMemo(fn) {
    return fn();
  },
  useRef(initial) {
    return { current: initial };
  },
  useCallback(fn) {
    return fn;
  },
};

export default React;
`;

const SDK_STUB = `
export const STATUSBAR_AREAS = Object.freeze({
  left: 'left',
  center: 'center',
  right: 'right',
});

export function Popover(props) {
  return { type: 'Popover', props };
}

export function PopoverTrigger(props) {
  return { type: 'PopoverTrigger', props };
}

export function PopoverContent(props) {
  return { type: 'PopoverContent', props };
}

export const host = {
  request: async () => null,
  requestProfile: async () => null,
  navigate: () => {},
  profileRoutes: () => [],
};

export function useValue(store) {
  return typeof store?.get === 'function' ? store.get() : store;
}

export let compactNumber = undefined;

export function __setCompactNumber(fn) {
  compactNumber = fn;
}
`;

const TEST_EXPORTS = `
export const __test = {
  STYLE_ID,
  STORAGE_KEY,
  PREV_STORAGE_KEYS,
  DEFAULT_PREFS,
  CURRENCY_META,
  PRESETS,
  I18N,
  MODEL_PRICING,
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
  discoverConnectionRoster,
  collectProfileSessionsForScope,
  resolveToneLevel,
  buildScopeLabel,
};
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'react') {
    return { shortCircuit: true, url: VIRTUAL_REACT };
  }
  if (specifier === '@hermes/plugin-sdk') {
    return { shortCircuit: true, url: VIRTUAL_SDK };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === VIRTUAL_REACT) {
    return { format: 'module', shortCircuit: true, source: REACT_STUB };
  }
  if (url === VIRTUAL_SDK) {
    return { format: 'module', shortCircuit: true, source: SDK_STUB };
  }
  if (url.startsWith('file:')) {
    const filePath = fileURLToPath(url);
    if (/[\\/]desktop[\\/]plugin\.js$/.test(filePath)) {
      const source = await readFile(filePath, 'utf8');
      return {
        format: 'module',
        shortCircuit: true,
        source: `${source}\n${TEST_EXPORTS}`,
      };
    }
  }
  return nextLoad(url, context);
}
