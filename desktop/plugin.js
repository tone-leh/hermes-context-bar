import React from 'react';
import {
  STATUSBAR_AREAS,
  Popover,
  PopoverTrigger,
  PopoverContent,
  host,
  useValue,
  compactNumber,
} from '@hermes/plugin-sdk';

const h = React.createElement;
const STYLE_ID = 'hermes-context-bar-style';
const STORAGE_KEY = 'prefs.v6';
const PREV_STORAGE_KEYS = ['prefs.v5', 'prefs.v4'];
const FALLBACK_LS_KEY = 'hermes.plugin.hermes-context-bar.prefs.v6';

const DEFAULT_PREFS = {
  // Status bar items
  showBar: true,
  showPct: true,
  showRemain: true,
  showSpeed: true,
  showTokens: true,
  showCache: false,
  showCost: true,
  showBot: false,
  showModel: false,
  // Scope & currency
  usageScope: 'session', // 'session' | 'bot' | 'all'
  timeRange: 'today', // 'today' | '7d' | 'month' | 'all'
  tokenDisplay: 'io', // 'io' | 'total'
  currency: 'USD', // 'USD' | 'CNY' | 'EUR' | 'HKD' | 'JPY'
  costPrecision: 'auto', // 'auto' | '2' | '3'
  fxRates: { USD: 1, CNY: 7.25, EUR: 0.92, HKD: 7.78, JPY: 154 },
  // Appearance & language
  language: 'auto', // 'auto' | 'zh' | 'en'
  themeSkin: 'mono', // 'mono' | 'prism'
  barMotion: true,
  barDensity: 'standard', // 'compact' | 'standard'
  showBreakdownBars: true,
  breakdownScale: 'used', // 'used' | 'window'
};

const CURRENCY_META = {
  USD: { code: 'USD', symbol: '$', defaultRate: 1 },
  CNY: { code: 'CNY', symbol: '¥', defaultRate: 7.25 },
  EUR: { code: 'EUR', symbol: '€', defaultRate: 0.92 },
  HKD: { code: 'HKD', symbol: 'HK$', defaultRate: 7.78 },
  JPY: { code: 'JPY', symbol: '¥', defaultRate: 154 },
};

const PRESETS = [
  {
    id: 'minimal',
    patch: {
      showBar: true,
      showPct: true,
      showRemain: false,
      showSpeed: false,
      showTokens: false,
      showCache: false,
      showCost: true,
      showBot: false,
      showModel: false,
    },
  },
  {
    id: 'balanced',
    patch: {
      showBar: true,
      showPct: true,
      showRemain: true,
      showSpeed: true,
      showTokens: true,
      showCache: false,
      showCost: true,
      showBot: false,
      showModel: false,
    },
  },
  {
    id: 'full',
    patch: {
      showBar: true,
      showPct: true,
      showRemain: true,
      showSpeed: true,
      showTokens: true,
      showCache: true,
      showCost: true,
      showBot: true,
      showModel: false,
    },
  },
];

const I18N = {
  zh: {
    pluginName: '上下文与用量控制',
    context: '上下文',
    breakdown: '构成',
    spend: '消耗',
    available: '可用余量',
    reserve: '压缩预留',
    toCompact: (v) => `距自动压缩 ${v}`,
    toCompactShort: (v) => `距压缩 ${v}`,
    toCompactTiny: (v) => `余 ${v}`,
    atLimit: '已达触发线',
    leftWindow: (v) => `剩余 ${v}`,
    threshold: (p) => `阈值 ${p}%`,
    thresholdCompacted: (p, n) => `阈值 ${p}% · 已压缩 ${n} 次`,
    autoOff: '压缩已关',
    cacheChip: (v) => `缓存 ${v}`,
    noBreakdown: '暂无拆解',
    loading: '加载中…',
    refresh: '刷新',
    settings: '设置',
    reset: '恢复默认',
    compact: '压缩上下文',
    compactConfirm: '确认压缩',
    compacting: '压缩中…',
    compactSkipped: '无需压缩',
    compactQueued: '后台压缩中',
    compactDone: '已压缩',
    compactFailed: '压缩失败',
    input: '输入',
    cachedInput: '缓存读取',
    output: '输出',
    reasoning: '思考',
    total: '合计',
    cache: '缓存',
    calls: '调用',
    speed: '速度',
    latency: '延迟',
    sessions: '会话',
    callsUnit: (n) => `${n} 次`,
    sessionsUnit: (n) => `${n} 条`,
    msgsUnit: (n) => `${n} 条`,
    scopeSession: '本会话',
    scopeAll: '全员',
    scopeAllCount: (n) => `全员(${n})`,
    trToday: '今日',
    trTodayShort: '今日',
    tr7d: '近 7 天',
    tr7dShort: '7天',
    trMonth: '本月',
    trMonthShort: '本月',
    trAll: '全部',
    trAllShort: '累计',
    tabPolicy: '策略',
    tabMetrics: '指标',
    tabScope: '口径',
    tabStyle: '外观',
    autoCompaction: (bot) => `自动压缩（${bot}）`,
    enableAutoCompact: '启用自动压缩',
    triggerThreshold: '触发阈值',
    targetRatio: '压缩目标占比',
    protectRecent: '保护最近消息',
    contextEngine: '上下文引擎',
    memoryBudget: '记忆占用预算',
    persistentMemory: '持久记忆',
    userProfile: '用户画像',
    memoryCharLimit: '记忆字符上限',
    userCharLimit: '画像字符上限',
    readOnlyBadge: '只读',
    stateOn: '已开启',
    stateOff: '已关闭',
    defaultVal: (v) => `${v}（默认）`,
    charsUnit: (n) => `${Math.round(n).toLocaleString('en-US')} 字符`,
    policyReadOnlyHint: '当前通过官方 SDK 只读展示策略参数；如需修改请前往官方设置页。',
    syncTarget: (bot) => `当前角色：${bot}`,
    openFullSettings: '打开官方设置页 ↗',
    presets: '预设',
    presetMinimal: '精简',
    presetBalanced: '均衡',
    presetFull: '全量',
    barItems: '状态栏显示项',
    itemBar: '上下文进度条',
    itemPct: '占用百分比',
    itemRemain: '距压缩余量',
    itemSpeed: '生成速度 (tok/s)',
    itemTokens: '消耗 Token',
    itemCache: '缓存命中率',
    itemCost: '费用金额',
    itemBot: '当前角色名',
    itemModel: '当前模型名',
    statProfiles: '统计角色',
    optSession: '当前会话',
    optAllBots: '全部角色',
    statTimeRange: '时间范围',
    tokenFormat: 'Token 格式',
    fmtIO: '↑入 ↓出',
    fmtTotal: '合并总计',
    currency: '货币单位',
    fxRate: (code) => `汇率 (1 USD → ${code})`,
    precision: '小数精度',
    precAuto: '智能',
    prec2: '2位',
    prec3: '3位',
    language: '界面语言',
    langAuto: '自动',
    themeSkin: '主题皮肤',
    skinMono: '极简黑白灰',
    skinPrism: '棱镜流光',
    shimmerMotion: '流光动效',
    barDensity: '状态栏密度',
    densityStd: '标准',
    densityCompact: '紧凑',
    breakdownDetail: '构成明细',
    showCatBars: '类目进度条',
    scaleUsed: '按已用比例',
    scaleWindow: '按总窗口比例',
    barTooltip: (u, w) => `占已用 ${u} / 占窗口 ${w}`,
    costTipFx: (r, c) => `1 USD = ${r} ${c}（点击切换货币）`,
    costTipSwitch: '点击切换货币',
    policyTip: '查看自动压缩与记忆策略',
    scopeTip: '切换统计口径',
    triggerAria: '上下文与用量',
    cat: {
      conversation: '对话历史',
      tool_definitions: '工具定义',
      skills: '技能索引',
      system_prompt: '系统提示词',
      subagent_definitions: '子代理定义',
      rules: '规则文件',
      memory: '长期记忆',
      mcp: 'MCP 工具',
    },
  },
  en: {
    pluginName: 'Context Bar',
    context: 'Context',
    breakdown: 'Breakdown',
    spend: 'Spend',
    available: 'Available',
    reserve: 'Reserve',
    toCompact: (v) => `${v} to compact`,
    toCompactShort: (v) => `${v} left`,
    toCompactTiny: (v) => `${v}`,
    atLimit: 'At limit',
    leftWindow: (v) => `${v} free`,
    threshold: (p) => `Trigger ${p}%`,
    thresholdCompacted: (p, n) => `Trigger ${p}% · ${n}x`,
    autoOff: 'Auto off',
    cacheChip: (v) => `Cache ${v}`,
    noBreakdown: 'No breakdown yet',
    loading: 'Loading…',
    refresh: 'Refresh',
    settings: 'Settings',
    reset: 'Reset',
    compact: 'Compact context',
    compactConfirm: 'Confirm compact',
    compacting: 'Compacting…',
    compactSkipped: 'Nothing to compact',
    compactQueued: 'Compacting in background',
    compactDone: 'Compacted',
    compactFailed: 'Compact failed',
    input: 'Input',
    cachedInput: 'Cache read',
    output: 'Output',
    reasoning: 'Reasoning',
    total: 'Total',
    cache: 'Cache',
    calls: 'Calls',
    speed: 'Speed',
    latency: 'Latency',
    sessions: 'Sessions',
    callsUnit: (n) => String(n),
    sessionsUnit: (n) => String(n),
    msgsUnit: (n) => `${n} msgs`,
    scopeSession: 'Session',
    scopeAll: 'All',
    scopeAllCount: (n) => `All (${n})`,
    trToday: 'Today',
    trTodayShort: 'Today',
    tr7d: '7 Days',
    tr7dShort: '7d',
    trMonth: 'Month',
    trMonthShort: 'Mo',
    trAll: 'All Time',
    trAllShort: 'All',
    tabPolicy: 'Policy',
    tabMetrics: 'Bar',
    tabScope: 'Scope',
    tabStyle: 'Style',
    autoCompaction: (bot) => `Auto-Compaction (${bot})`,
    enableAutoCompact: 'Auto-compact',
    triggerThreshold: 'Trigger threshold',
    targetRatio: 'Target summary ratio',
    protectRecent: 'Protect recent turns',
    contextEngine: 'Context engine',
    memoryBudget: 'Memory Budget',
    persistentMemory: 'Persistent memory',
    userProfile: 'User profile',
    memoryCharLimit: 'Memory char limit',
    userCharLimit: 'Profile char limit',
    readOnlyBadge: 'Read-only',
    stateOn: 'Enabled',
    stateOff: 'Disabled',
    defaultVal: (v) => `${v} (default)`,
    charsUnit: (n) => `${Math.round(n).toLocaleString('en-US')} chars`,
    policyReadOnlyHint: 'Read-only overview via the official SDK. Open Settings to modify policy keys.',
    syncTarget: (bot) => `Profile: ${bot}`,
    openFullSettings: 'Open Settings ↗',
    presets: 'Presets',
    presetMinimal: 'Minimal',
    presetBalanced: 'Balanced',
    presetFull: 'Full',
    barItems: 'Status Bar Items',
    itemBar: 'Context bar',
    itemPct: 'Context %',
    itemRemain: 'Runway to compact',
    itemSpeed: 'Generation speed (tok/s)',
    itemTokens: 'Token count',
    itemCache: 'Cache hit rate',
    itemCost: 'Spend',
    itemBot: 'Bot name',
    itemModel: 'Model badge',
    statProfiles: 'Profile Scope',
    optSession: 'Session',
    optAllBots: 'All Bots',
    statTimeRange: 'Time Range',
    tokenFormat: 'Token Format',
    fmtIO: '↑In ↓Out',
    fmtTotal: 'Combined',
    currency: 'Currency',
    fxRate: (code) => `Rate (1 USD → ${code})`,
    precision: 'Precision',
    precAuto: 'Auto',
    prec2: '2 dec',
    prec3: '3 dec',
    language: 'Language',
    langAuto: 'Auto',
    themeSkin: 'Theme Skin',
    skinMono: 'Monochrome',
    skinPrism: 'Prism',
    shimmerMotion: 'Shimmer motion',
    barDensity: 'Bar Density',
    densityStd: 'Standard',
    densityCompact: 'Compact',
    breakdownDetail: 'Breakdown',
    showCatBars: 'Category bars',
    scaleUsed: 'Share of used',
    scaleWindow: 'Share of window',
    barTooltip: (u, w) => `${u} of used / ${w} of window`,
    costTipFx: (r, c) => `1 USD = ${r} ${c} (click to configure)`,
    costTipSwitch: 'Click to switch currency',
    policyTip: 'View context & memory policy',
    scopeTip: 'Change spend scope',
    triggerAria: 'Context and usage controls',
    cat: {
      conversation: 'Conversation',
      tool_definitions: 'Tools',
      skills: 'Skills',
      system_prompt: 'System Prompt',
      subagent_definitions: 'Subagents',
      rules: 'Rules',
      memory: 'Memory',
      mcp: 'MCP',
    },
  },
};

const CATEGORY_COLORS = {
  conversation: '#7c3aed',
  tool_definitions: '#5b73d6',
  skills: '#4c93ad',
  system_prompt: '#7b8498',
  subagent_definitions: '#9c71b5',
  rules: '#53947c',
  memory: '#b58d52',
  mcp: '#b57862',
};

const MONO_OPACITIES = [0.85, 0.56, 0.40, 0.30, 0.22, 0.16, 0.12];
const PRISM_FALLBACK_COLORS = ['#7c3aed', '#5b73d6', '#4c93ad', '#7b8498', '#9c71b5', '#53947c'];

// Scheduled Google official API rate transitions (UTC):
// - Gemini 3.8 / 3.7 Flash promo ($0.75/$3.75/$0.075) through 2026-12-31; standard ($1.50/$7.50/$0.15) from 2027-01-01.
const GEMINI_38_FLASH_STD_AT_MS = Date.UTC(2027, 0, 1, 0, 0, 0);

// Per-1M USD fallback rates: [input, output, cacheRead, optionalTierRule]
// Aligned with verified Google Cloud Billing SKU charges and Hermes v0.23.4 agent/usage_pricing.py.
const MODEL_PRICING = [
  // --- Google Gemini 4 Official API ---
  // Verified against live Google Cloud Billing SKUs: Carbon bills at $4.00 in / $20.00 out / $0.20 cache read.
  [/gemini[-./]*4[-.]*(carbon|argon)/i, [4.0, 20.0, 0.2]],
  [/gemini[-./]*4[-.]*neon/i, [3.0, 15.0, 0.15]],
  [/gemini[-./]*4[-.]*hydrogen/i, [1.5, 7.5, 0.075]],
  // --- Google Gemini 3.x Official API ---
  [
    /gemini[-./]*3\.(8|7)[-.]*flash/i,
    [0.75, 3.75, 0.075, { effectiveAtMs: GEMINI_38_FLASH_STD_AT_MS, nextRates: [1.5, 7.5, 0.15] }],
  ],
  [/gemini[-./]*3\.6[-.]*flash/i, [1.5, 7.5, 0.15]],
  [/gemini[-./]*3\.5[-.]*flash[-.]*lite/i, [0.3, 2.5, 0.03]],
  [/gemini[-./]*3\.5[-.]*flash/i, [1.5, 9.0, 0.15]],
  [/gemini[-./]*3\.1[-.]*flash[-.]*lite/i, [0.25, 1.5, 0.025]],
  [
    /gemini[-./]*3(\.1)?[-.]*pro/i,
    [2.0, 12.0, 0.2, { tierThresholdTokens: 200_000, aboveRates: [4.0, 18.0, 0.4] }],
  ],
  [/gemini[-./]*3[-.]*flash/i, [0.5, 3.0, 0.05]],
  // --- Google Gemini 2.5 / 2.0 Official API ---
  [
    /gemini[-./]*2\.5[-.]*pro/i,
    [1.25, 10.0, 0.125, { tierThresholdTokens: 200_000, aboveRates: [2.5, 15.0, 0.25] }],
  ],
  [/gemini[-./]*2\.5[-.]*flash[-.]*lite/i, [0.1, 0.4, 0.01]],
  [/gemini[-./]*2\.5[-.]*flash/i, [0.15, 0.6, 0.015]],
  [/gemini[-./]*2\.0[-.]*flash/i, [0.1, 0.4, 0.01]],
  [/gemini.*flash[-.]*lite/i, [0.25, 1.5, 0.025]],
  [/gemini.*flash/i, [0.75, 3.75, 0.075]],
  [/gemini.*(pro|ultra)/i, [2.0, 12.0, 0.2]],
  // --- Anthropic Claude ---
  [/claude[-./]*(fable|mythos)[-./]*5/i, [8.0, 40.0, 0.2]],
  [/claude[-./]*opus[-./]*5[-.]*5/i, [4.0, 20.0, 0.2]],
  [/claude[-./]*opus[-./]*4[-.]*8[-.]*fast/i, [10.0, 50.0, 1.0]],
  [/claude[-./]*opus[-./]*(4[-.](5|6|7|8)|5\b)/i, [5.0, 25.0, 0.5]],
  [/claude.*opus/i, [15.0, 75.0, 1.5]],
  [/claude.*sonnet/i, [3.0, 15.0, 0.3]],
  [/claude[-./]*haiku[-./]*4[-.]*5/i, [1.0, 5.0, 0.1]],
  [/claude.*haiku/i, [0.8, 4.0, 0.08]],
  // --- OpenAI Pay-As-You-Go API (subscription routes short-circuit to $0 before this table) ---
  [/gpt-6\.2[-.]*astra/i, [8.0, 40.0, 0.4]],
  [/gpt-6[-.]*astra/i, [10.0, 50.0, 1.0]],
  [/gpt-6\.2[-.]*sol/i, [2.0, 10.0, 0.1]],
  [/gpt-6[-.]*luna/i, [0.1, 0.5, 0.01]],
  [/gpt-5\.6-sol/i, [5.0, 30.0, 0.5]],
  [/gpt-5\.6-terra/i, [2.5, 15.0, 0.25]],
  [/gpt-5\.6-luna/i, [1.0, 6.0, 0.1]],
  [/gpt-4\.1-nano/i, [0.1, 0.4, 0.025]],
  [/gpt-4\.1-mini/i, [0.4, 1.6, 0.1]],
  [/gpt-4\.1/i, [2.0, 8.0, 0.5]],
  [/gpt-4o-mini|o4-mini/i, [0.15, 0.6, 0.075]],
  [/o3-mini/i, [1.1, 4.4, 0.55]],
  [/gpt-4o|gpt-5|gpt-6|codex|astra|sol|terra|luna/i, [2.5, 10.0, 1.25]],
  [/\bo1\b|\bo3\b/i, [10.0, 40.0, 2.5]],
  // --- DeepSeek / Others ---
  [/deepseek[-./]*v4[-.]*pro/i, [0.66, 1.98, 0.022]],
  [/deepseek[-./]*v4[-.]*flash/i, [0.15, 0.6, 0.003]],
  [/deepseek.*(r1|reasoner)/i, [0.55, 2.19, 0.14]],
  [/deepseek/i, [0.15, 0.6, 0.003]],
  [/kimi|moonshot/i, [0.6, 2.5, 0.15]],
  [/glm/i, [0.5, 2.0, 0.1]],
  [/qwen/i, [0.4, 1.2, 0.1]],
];

const ZERO_MARGINAL_PROVIDERS = new Set([
  'openai-codex',
  'chatgpt-sub',
  'custom:chatgpt-sub',
  'opencodex',
  'custom:opencodex',
  'claude-code',
  'xai-oauth',
  'ollama',
  'vllm',
  'llamacpp',
  'llama.cpp',
  'llama-cpp',
  'local',
]);

const STYLES = `
@keyframes lub-silk-sheen {
  0% { transform: translateX(-160%) skewX(-18deg); opacity: 0; }
  25% { opacity: 0.42; }
  55% { opacity: 0.28; }
  100% { transform: translateX(300%) skewX(-18deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .lub-bar-sheen { animation: none !important; opacity: 0 !important; }
}

/* ---- Bottom Status Bar Trigger ---- */
.lub-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ui-text-secondary, #666);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 140ms ease, color 140ms ease;
}
.lub-trigger[data-density="compact"] {
  gap: 6px;
  padding: 0 6px;
}
.lub-trigger:hover,
.lub-trigger[data-state="open"] {
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10));
  color: var(--foreground, inherit);
}
.lub-trigger:focus-visible {
  outline: 1.5px solid var(--ui-stroke-secondary, rgba(128, 128, 128, 0.5));
  outline-offset: -2px;
}
.lub-divider {
  display: block;
  width: 1px;
  height: 10px;
  background: var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.24));
  flex-shrink: 0;
}
.lub-chip-primary {
  font-weight: 500;
  color: var(--foreground, inherit);
}
.lub-chip-primary[data-tone="warn"] { color: #b45309; }
.lub-chip-primary[data-tone="danger"] { color: #dc2626; }
.lub-chip-muted {
  color: var(--ui-text-secondary, #666);
}
.lub-speed {
  display: inline-flex;
  align-items: baseline;
  gap: 2.5px;
}
.lub-chip-unit {
  font-size: 10px;
  font-weight: 400;
  color: var(--ui-text-tertiary, #888);
}
.lub-chip-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  background: var(--ui-bg-secondary, rgba(128, 128, 128, 0.12));
  color: var(--ui-text-secondary, #666);
}

/* ---- Progress Bar (Mono default / Prism optional skin) ---- */
.lub-bar-track {
  position: relative;
  display: block;
  width: 78px;
  height: 6px;
  border-radius: 9999px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(128, 128, 128, 0.16);
}
.lub-trigger[data-density="compact"] .lub-bar-track {
  width: 58px;
  height: 5px;
}
.lub-bar-fill,
.lub-hero-fill {
  position: relative;
  display: block;
  height: 100%;
  border-radius: 9999px;
  overflow: hidden;
  background: var(--foreground, #18181b);
  transition: width 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.lub-bar-fill[data-tone="warn"],
.lub-hero-fill[data-tone="warn"] { background: #b45309; }
.lub-bar-fill[data-tone="danger"],
.lub-hero-fill[data-tone="danger"] { background: #dc2626; }
.lub-bar-fill[data-skin="prism"],
.lub-hero-fill[data-skin="prism"] {
  background: linear-gradient(90deg, #4c1d95 0%, #6d28d9 58%, #9370f7 100%);
  box-shadow: inset -1px 0 2px rgba(255, 255, 255, 0.32);
}
.lub-bar-fill[data-skin="prism"][data-tone="warn"],
.lub-hero-fill[data-skin="prism"][data-tone="warn"] {
  background: linear-gradient(90deg, #92400e 0%, #d97706 60%, #f59e0b 100%);
}
.lub-bar-fill[data-skin="prism"][data-tone="danger"],
.lub-hero-fill[data-skin="prism"][data-tone="danger"] {
  background: linear-gradient(90deg, #991b1b 0%, #dc2626 60%, #f87171 100%);
}
.lub-bar-sheen {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 36%;
  display: block;
  pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.36) 50%, transparent 100%);
  animation: lub-silk-sheen 5.6s ease-in-out infinite;
}
.lub-bar-mark {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(128, 128, 128, 0.45);
  pointer-events: none;
}

/* ---- Popover Outer Shell (No overflow trap on Radix Arrow) ---- */
.lub-pop {
  width: 352px !important;
  padding: 0 !important;
  overflow: visible !important;
  max-height: none !important;
}
.lub-card {
  --lub-accent: var(--foreground, #18181b);
  --lub-accent-fg: var(--background, #ffffff);
  --lub-accent-soft: rgba(128, 128, 128, 0.11);
  --lub-accent-border: rgba(128, 128, 128, 0.48);
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  font-size: 12px;
  line-height: 1.45;
  font-variant-numeric: tabular-nums;
}
.lub-card[data-skin="prism"] {
  --lub-accent: #7c3aed;
  --lub-accent-fg: #ffffff;
  --lub-accent-soft: rgba(124, 58, 237, 0.10);
  --lub-accent-border: rgba(124, 58, 237, 0.65);
}

.lub-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.lub-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.lub-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.lub-bot {
  font-weight: 600;
  font-size: 13px;
  color: var(--foreground, inherit);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lub-badge {
  display: inline-flex;
  align-items: center;
  padding: 1.5px 6px;
  border-radius: 5px;
  font-size: 10.5px;
  font-weight: 500;
  background: var(--ui-bg-secondary, rgba(128, 128, 128, 0.11));
  color: var(--ui-text-secondary, #666);
  max-width: 155px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lub-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ui-text-secondary, #666);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.lub-icon-btn:hover {
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.12));
  color: var(--foreground, inherit);
}

.lub-section {
  padding: 11px 0;
  border-top: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.14));
}
.lub-section:first-of-type {
  padding-top: 0;
  border-top: 0;
}
.lub-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.lub-sec-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--foreground, inherit);
}
.lub-big-stat {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--foreground, inherit);
}
.lub-inline-link {
  border: 0;
  padding: 1px 5px;
  border-radius: 5px;
  background: transparent;
  color: var(--ui-text-secondary, #666);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: background-color 140ms ease, color 140ms ease;
}
.lub-inline-link:hover {
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10));
  color: var(--foreground, inherit);
}

/* ---- Popover Hero Bar ---- */
.lub-hero-track {
  position: relative;
  display: block;
  width: 100%;
  height: 7px;
  border-radius: 9999px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.13);
  margin-bottom: 8px;
}
.lub-hero-buffer {
  position: absolute;
  top: 0;
  bottom: 0;
  right: 0;
  display: block;
  pointer-events: none;
  background: repeating-linear-gradient(
    -45deg,
    rgba(128, 128, 128, 0.11),
    rgba(128, 128, 128, 0.11) 3px,
    transparent 3px,
    transparent 7px
  );
  border-left: 1px solid rgba(128, 128, 128, 0.42);
}
.lub-runway-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--ui-text-secondary, #666);
}
.lub-runway-main {
  color: var(--foreground, inherit);
  font-weight: 500;
}

/* ---- Category Breakdown ---- */
.lub-cat-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.lub-cat-divider {
  height: 1px;
  margin: 2px 0;
  background: var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.12));
}
.lub-cat-row {
  display: grid;
  grid-template-columns: 7px minmax(72px, 1fr) 68px 52px 36px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.lub-cat-row[data-nobar="true"] {
  grid-template-columns: 7px minmax(88px, 1fr) 62px 42px;
}
.lub-dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 9999px;
}
.lub-dot-free {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  border: 1px solid rgba(128, 128, 128, 0.45);
  background: transparent;
}
.lub-dot-buf {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 1.5px;
  background: repeating-linear-gradient(
    -45deg,
    rgba(128, 128, 128, 0.45),
    rgba(128, 128, 128, 0.45) 1.5px,
    transparent 1.5px,
    transparent 3px
  );
}
.lub-cat-name {
  color: var(--ui-text-secondary, #555);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lub-cat-bar-bg {
  display: block;
  width: 100%;
  height: 3.5px;
  border-radius: 9999px;
  overflow: hidden;
  background: rgba(128, 128, 128, 0.11);
}
.lub-cat-bar-fg {
  display: block;
  height: 100%;
  border-radius: 9999px;
  transition: width 220ms ease;
}
.lub-cat-tok {
  text-align: right;
  color: var(--foreground, inherit);
  font-weight: 500;
}
.lub-cat-pct {
  text-align: right;
  color: var(--ui-text-tertiary, #888);
}

/* ---- Consumption Grid ---- */
.lub-scope-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1.5px 6px;
  border: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.22));
  border-radius: 5px;
  background: transparent;
  color: var(--ui-text-secondary, #666);
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease;
}
.lub-scope-btn:hover {
  border-color: var(--lub-accent-border);
  color: var(--foreground, inherit);
}
.lub-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 18px;
}
.lub-kv {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}
.lub-k {
  font-size: 11px;
  color: var(--ui-text-tertiary, #888);
}
.lub-v {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--foreground, inherit);
}

/* ---- Footer Actions ---- */
.lub-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.14));
}
.lub-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--ui-stroke-secondary, rgba(128, 128, 128, 0.24));
  background: transparent;
  color: var(--foreground, inherit);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}
.lub-btn:hover:not(:disabled) {
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10));
  border-color: var(--ui-stroke-secondary, rgba(128, 128, 128, 0.42));
}
.lub-btn:disabled { opacity: 0.42; cursor: not-allowed; }
.lub-btn-confirm {
  border-color: rgba(180, 83, 9, 0.65);
  background: rgba(180, 83, 9, 0.08);
  color: #b45309;
}
.lub-status-note {
  font-size: 10.5px;
  color: var(--ui-text-tertiary, #888);
}
.lub-status-note[data-state="err"] { color: #dc2626; }

/* ---- Secondary Config Panel ---- */
.lub-cfg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}
.lub-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--foreground, inherit);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.lub-back-btn:hover { background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10)); }
.lub-text-btn {
  border: 0;
  padding: 3px 6px;
  border-radius: 5px;
  background: transparent;
  color: var(--ui-text-tertiary, #888);
  font-size: 11px;
  cursor: pointer;
}
.lub-text-btn:hover {
  color: var(--foreground, inherit);
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10));
}
.lub-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  padding: 3px;
  border-radius: 7px;
  background: var(--ui-bg-secondary, rgba(128, 128, 128, 0.10));
  margin-bottom: 12px;
}
.lub-tab {
  border: 0;
  border-radius: 5px;
  padding: 5px 4px;
  background: transparent;
  color: var(--ui-text-secondary, #666);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease;
}
.lub-tab[data-active="true"] {
  background: var(--ui-bg-elevated, var(--background, #fff));
  color: var(--foreground, #111);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.10);
}
.lub-cfg-body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: min(540px, 76vh);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.28) transparent;
}
.lub-cfg-body::-webkit-scrollbar { width: 4px; }
.lub-cfg-body::-webkit-scrollbar-track { background: transparent; }
.lub-cfg-body::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.28);
  border-radius: 9999px;
}
.lub-cfg-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.lub-cfg-group + .lub-cfg-group {
  padding-top: 8px;
  border-top: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.12));
}
.lub-cfg-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.lub-cfg-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--ui-text-secondary, #666);
}
.lub-seg-row {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.lub-seg-btn {
  flex: 1 1 0;
  min-width: 44px;
  padding: 5px 6px;
  border-radius: 6px;
  border: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.22));
  background: transparent;
  color: var(--ui-text-secondary, #666);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  text-align: center;
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}
.lub-seg-btn:hover {
  border-color: var(--lub-accent-border);
  color: var(--foreground, inherit);
}
.lub-seg-btn[data-active="true"] {
  border-color: var(--lub-accent-border);
  background: var(--lub-accent-soft);
  color: var(--foreground, inherit);
  font-weight: 600;
}
.lub-toggle-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lub-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 2px;
  border-radius: 6px;
  cursor: pointer;
}
.lub-toggle-row:hover { background: var(--chrome-action-hover, rgba(128, 128, 128, 0.06)); }
.lub-toggle-title {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--foreground, inherit);
}
.lub-switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 16px;
  border-radius: 9999px;
  border: 0;
  padding: 0;
  flex-shrink: 0;
  background: rgba(128, 128, 128, 0.28);
  cursor: pointer;
  transition: background-color 160ms ease;
}
.lub-switch[data-checked="true"] { background: var(--lub-accent); }
.lub-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  background: var(--lub-accent-fg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.lub-switch[data-checked="true"] .lub-switch-thumb { transform: translateX(12px); }
.lub-inline-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 2px;
}
.lub-num-input {
  width: 72px;
  padding: 3px 7px;
  border-radius: 5px;
  border: 1px solid var(--ui-stroke-secondary, rgba(128, 128, 128, 0.28));
  background: transparent;
  color: var(--foreground, inherit);
  font-size: 11.5px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.lub-num-input:focus {
  outline: 1.5px solid var(--lub-accent-border);
  border-color: transparent;
}
.lub-readonly-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 500;
  background: var(--ui-bg-secondary, rgba(128, 128, 128, 0.11));
  color: var(--ui-text-tertiary, #888);
}
.lub-policy-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lub-policy-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 2px;
}
.lub-policy-key {
  font-size: 11.5px;
  color: var(--ui-text-secondary, #666);
}
.lub-policy-val {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--foreground, inherit);
  text-align: right;
}
.lub-policy-val[data-muted="true"] {
  font-weight: 400;
  color: var(--ui-text-tertiary, #888);
}
.lub-policy-foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.12));
}
.lub-policy-note {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--ui-text-tertiary, #888);
}
.lub-settings-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--lub-accent-border);
  background: var(--lub-accent-soft);
  color: var(--foreground, inherit);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 140ms ease, border-color 140ms ease;
}
.lub-settings-cta:hover {
  background: var(--chrome-action-hover, rgba(128, 128, 128, 0.16));
  border-color: var(--foreground, rgba(128, 128, 128, 0.65));
}
`;

// ---- Uniform 1.75px-stroke inline SVG icons ----
function IconRefresh() {
  return h(
    'svg',
    { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
    h('path', { d: 'M21 3v6h-6' })
  );
}

function IconSliders() {
  return h(
    'svg',
    { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('line', { x1: 4, y1: 6, x2: 20, y2: 6 }),
    h('circle', { cx: 9, cy: 6, r: 2 }),
    h('line', { x1: 4, y1: 12, x2: 20, y2: 12 }),
    h('circle', { cx: 15, cy: 12, r: 2 }),
    h('line', { x1: 4, y1: 18, x2: 20, y2: 18 }),
    h('circle', { cx: 11, cy: 18, r: 2 })
  );
}

function IconChevronLeft() {
  return h(
    'svg',
    { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.85, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M15 18l-6-6 6-6' })
  );
}

function IconChevronDown() {
  return h(
    'svg',
    { width: 10, height: 10, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M6 9l6 6 6-6' })
  );
}

// ---- Language Detection ----
function resolveLang(prefLang, ctx) {
  if (prefLang === 'zh' || prefLang === 'en') return prefLang;
  const candidates = [];
  try {
    const ctxLocale = typeof ctx?.i18n?.locale?.get === 'function' ? ctx.i18n.locale.get() : ctx?.i18n?.locale;
    if (typeof ctxLocale === 'string') candidates.push(ctxLocale);
  } catch {}
  try {
    if (typeof document !== 'undefined' && document.documentElement?.lang) {
      candidates.push(document.documentElement.lang);
    }
  } catch {}
  try {
    if (typeof globalThis.navigator?.language === 'string') {
      candidates.push(globalThis.navigator.language);
    }
  } catch {}
  for (const c of candidates) {
    const norm = String(c).trim().toLowerCase();
    if (!norm) continue;
    if (norm.startsWith('zh')) return 'zh';
    return 'en';
  }
  return 'en';
}

// ---- Storage Helpers ----
function sanitizePrefs(raw) {
  const base = { ...DEFAULT_PREFS, fxRates: { ...DEFAULT_PREFS.fxRates } };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of [
    'showBar',
    'showPct',
    'showRemain',
    'showSpeed',
    'showTokens',
    'showCache',
    'showCost',
    'showBot',
    'showModel',
    'barMotion',
    'showBreakdownBars',
  ]) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  }
  if (['session', 'bot', 'all'].includes(raw.usageScope)) base.usageScope = raw.usageScope;
  if (['today', '7d', 'month', 'all'].includes(raw.timeRange)) base.timeRange = raw.timeRange;
  if (['io', 'total'].includes(raw.tokenDisplay)) base.tokenDisplay = raw.tokenDisplay;
  if (raw.currency && CURRENCY_META[raw.currency]) base.currency = raw.currency;
  if (['auto', '2', '3'].includes(String(raw.costPrecision))) base.costPrecision = String(raw.costPrecision);
  if (['auto', 'zh', 'en'].includes(raw.language)) base.language = raw.language;
  if (['mono', 'prism'].includes(raw.themeSkin)) base.themeSkin = raw.themeSkin;
  if (['compact', 'standard'].includes(raw.barDensity)) base.barDensity = raw.barDensity;
  if (['used', 'window'].includes(raw.breakdownScale)) base.breakdownScale = raw.breakdownScale;
  if (raw.fxRates && typeof raw.fxRates === 'object') {
    for (const code of Object.keys(CURRENCY_META)) {
      const n = Number(raw.fxRates[code]);
      if (Number.isFinite(n) && n > 0) base.fxRates[code] = n;
    }
  }
  return base;
}

function loadPrefs(ctx) {
  try {
    if (ctx?.storage && typeof ctx.storage.get === 'function') {
      const saved = ctx.storage.get(STORAGE_KEY, null);
      if (saved && typeof saved === 'object' && typeof saved.then !== 'function') {
        return sanitizePrefs(saved);
      }
      for (const oldKey of PREV_STORAGE_KEYS) {
        const prev = ctx.storage.get(oldKey, null);
        if (prev && typeof prev === 'object' && typeof prev.then !== 'function') {
          return sanitizePrefs(prev);
        }
      }
    }
  } catch {}
  try {
    const raw = globalThis.localStorage?.getItem(FALLBACK_LS_KEY);
    if (raw) return sanitizePrefs(JSON.parse(raw));
  } catch {}
  return sanitizePrefs(null);
}

function savePrefs(ctx, prefs) {
  try {
    if (ctx?.storage && typeof ctx.storage.set === 'function') {
      ctx.storage.set(STORAGE_KEY, prefs);
      return;
    }
  } catch {}
  try {
    globalThis.localStorage?.setItem(FALLBACK_LS_KEY, JSON.stringify(prefs));
  } catch {}
}

// ---- Official Hermes SDK Config Helpers (read-only via host.request / host.requestProfile) ----
function extractContextPolicy(cfg) {
  const comp = cfg?.compression && typeof cfg.compression === 'object' ? cfg.compression : {};
  const ctxSec = cfg?.context && typeof cfg.context === 'object' ? cfg.context : {};
  const mem = cfg?.memory && typeof cfg.memory === 'object' ? cfg.memory : {};
  return {
    enabled: comp.enabled !== false,
    threshold: normalizeThreshold(comp.threshold),
    targetRatio: normalizeThreshold(comp.target_ratio),
    protectLastN: toNum(comp.protect_last_n),
    contextEngine: typeof ctxSec.engine === 'string' ? ctxSec.engine : '',
    memoryEnabled: mem.memory_enabled !== false,
    userProfileEnabled: mem.user_profile_enabled !== false,
    memoryCharLimit: toNum(mem.memory_char_limit),
    userCharLimit: toNum(mem.user_char_limit),
  };
}

function buildConfigGetParams(route, profileSlug, key) {
  const params = { key };
  const prof = String(profileSlug || '').trim();
  if (!route && prof && prof !== 'default') {
    params.profile = prof;
  }
  return params;
}

function unwrapConfigValue(res) {
  if (!res || typeof res !== 'object') return undefined;
  return res.value !== undefined ? res.value : res;
}

function mergeSdkConfigResponses(fullRes, providerRes, sectionRes = {}) {
  const baseCfg = fullRes?.config && typeof fullRes.config === 'object' ? fullRes.config : {};
  const compBase = baseCfg.compression && typeof baseCfg.compression === 'object' ? baseCfg.compression : {};
  const ctxBase = baseCfg.context && typeof baseCfg.context === 'object' ? baseCfg.context : {};
  const memBase = baseCfg.memory && typeof baseCfg.memory === 'object' ? baseCfg.memory : {};
  const modelBase = baseCfg.model && typeof baseCfg.model === 'object' ? baseCfg.model : {};

  const compExtraRaw = unwrapConfigValue(sectionRes.compression);
  const compExtra =
    compExtraRaw && typeof compExtraRaw === 'object' && !Array.isArray(compExtraRaw) ? compExtraRaw : {};
  const ctxExtraRaw = unwrapConfigValue(sectionRes.context);
  const ctxExtra =
    ctxExtraRaw && typeof ctxExtraRaw === 'object' && !Array.isArray(ctxExtraRaw) ? ctxExtraRaw : {};
  const memExtraRaw = unwrapConfigValue(sectionRes.memory);
  const memExtra =
    memExtraRaw && typeof memExtraRaw === 'object' && !Array.isArray(memExtraRaw) ? memExtraRaw : {};

  const compMerged = { ...compBase, ...compExtra };
  const enVal = sectionRes.enabled?.value;
  if (typeof enVal === 'boolean') {
    compMerged.enabled = enVal;
  } else if (typeof enVal === 'string' && ['true', 'false', 'on', 'off'].includes(enVal.toLowerCase())) {
    compMerged.enabled = enVal.toLowerCase() === 'true' || enVal.toLowerCase() === 'on';
  }
  if (sectionRes.threshold?.value !== undefined && sectionRes.threshold.value !== null) {
    compMerged.threshold = sectionRes.threshold.value;
  }

  const mergedCfg = {
    ...baseCfg,
    compression: compMerged,
    context: { ...ctxBase, ...ctxExtra },
    memory: { ...memBase, ...memExtra },
  };

  const provFromRpc = typeof providerRes?.provider === 'string' ? providerRes.provider : '';
  const routeHint = {
    provider: provFromRpc || (typeof modelBase.provider === 'string' ? modelBase.provider : ''),
    base_url: typeof modelBase.base_url === 'string' ? modelBase.base_url : '',
  };

  return {
    policy: extractContextPolicy(mergedCfg),
    routeHint,
  };
}

async function readPolicyViaSdk(route, profileSlug, callFn = gwCall) {
  const mk = (key) => buildConfigGetParams(route, profileSlug, key);
  const safeGet = (key) =>
    Promise.resolve()
      .then(() => callFn(route, 'config.get', mk(key)))
      .catch(() => null);

  const [fullRes, providerRes] = await Promise.all([safeGet('full'), safeGet('provider')]);
  const fullCfg = fullRes?.config && typeof fullRes.config === 'object' ? fullRes.config : null;
  const hasFullPolicy = Boolean(fullCfg && (fullCfg.compression || fullCfg.memory || fullCfg.context));

  let sectionRes = {};
  if (!hasFullPolicy) {
    const [compression, enabled, threshold, memory, context] = await Promise.all([
      safeGet('compression'),
      safeGet('compression.enabled'),
      safeGet('compression.threshold'),
      safeGet('memory'),
      safeGet('context'),
    ]);
    sectionRes = { compression, enabled, threshold, memory, context };
  }

  return mergeSdkConfigResponses(fullRes, providerRes, sectionRes);
}

// ---- Numeric, Time & Pricing Helpers ----
function toNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function toEpochMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw > 1e12 ? raw : raw * 1000;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n > 1e12 ? n : n * 1000;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getTimeRangeCutoffMs(timeRange, nowMs = Date.now()) {
  if (timeRange === 'all') return 0;
  const d = new Date(nowMs);
  if (timeRange === 'today') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  if (timeRange === '7d') return nowMs - 7 * 24 * 60 * 60 * 1000;
  if (timeRange === 'month') return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
  return 0;
}

function fmtCompact(n) {
  if (n == null) return '—';
  if (typeof compactNumber === 'function') {
    try {
      return compactNumber(n);
    } catch {}
  }
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function fmtFull(n) {
  if (n == null) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function fmtPct(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return '—';
  const pct = ratio * 100;
  if (pct > 0 && pct < 0.1) return '<0.1%';
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function fmtTps(tps) {
  if (tps == null || !Number.isFinite(tps) || tps <= 0) return null;
  return tps >= 100 ? tps.toFixed(0) : tps.toFixed(1);
}

/**
 * Lightweight mixed CJK / Latin token estimator for real-time streaming tok/s.
 * Replaced by exact gateway-reported tokens_per_s as soon as the turn settles.
 */
function estimateChunkTokens(text) {
  if (typeof text !== 'string' || !text) return 0;
  let cjk = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code >= 0x3400 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff)) cjk++;
  }
  const other = text.length - cjk;
  return cjk * 0.65 + other * 0.26;
}

function fmtCurrency(usdAmount, estimated, prefs) {
  if (usdAmount == null) return '—';
  const meta = CURRENCY_META[prefs.currency] || CURRENCY_META.USD;
  const rate = prefs.currency === 'USD' ? 1 : (toNum(prefs.fxRates?.[prefs.currency]) || meta.defaultRate);
  const converted = usdAmount * rate;
  const prefix = `${estimated ? '~' : ''}${meta.symbol}`;
  if (converted === 0) return `${prefix}0.00`;
  if (prefs.currency === 'JPY') {
    return converted < 1 ? `${prefix}${converted.toFixed(2)}` : `${prefix}${Math.round(converted).toLocaleString('en-US')}`;
  }
  if (prefs.costPrecision === '2') return `${prefix}${converted.toFixed(2)}`;
  if (prefs.costPrecision === '3') return `${prefix}${converted.toFixed(3)}`;
  if (converted < 0.001) return `${prefix}<0.001`;
  if (converted < 0.1) return `${prefix}${converted.toFixed(3)}`;
  return `${prefix}${converted.toFixed(2)}`;
}

function normalizeThreshold(raw) {
  const n = typeof raw === 'string' ? Number(raw) : toNum(raw);
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n > 0 && n <= 1) return n;
  return null;
}

function resolveModelName(liveUsage, rpcUsage, persistedSession, modelState) {
  for (const cand of [rpcUsage?.model, liveUsage?.model, persistedSession?.model]) {
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
  }
  if (typeof modelState === 'string' && modelState.trim()) return modelState.trim();
  if (modelState && typeof modelState === 'object') {
    const candidate = modelState.model || modelState.id || modelState.name || '';
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function pickBestNum(...vals) {
  let firstNum = null;
  for (const v of vals) {
    const n = toNum(v);
    if (n != null) {
      if (n > 0) return n;
      if (firstNum === null) firstNum = n;
    }
  }
  return firstNum;
}

function isPrivateOrLoopbackUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
  try {
    const u = new URL(rawUrl.trim());
    const hostName = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      hostName === 'localhost' ||
      hostName === '127.0.0.1' ||
      hostName === '::1' ||
      hostName === '0.0.0.0' ||
      hostName.endsWith('.local')
    ) {
      return true;
    }
    if (
      /^10\.\d+\.\d+\.\d+$/.test(hostName) ||
      /^192\.168\.\d+\.\d+$/.test(hostName) ||
      /^100\.\d+\.\d+\.\d+$/.test(hostName)
    ) {
      return true;
    }
    const m172 = hostName.match(/^172\.(\d+)\.\d+\.\d+$/);
    if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
  } catch {}
  return false;
}

function isZeroMarginalCostSource(...sources) {
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    const costStatus = String(src.cost_status ?? src.costStatus ?? '').trim().toLowerCase();
    const billingMode = String(src.billing_mode ?? src.billingMode ?? '').trim().toLowerCase();
    if (costStatus === 'included' || billingMode === 'subscription_included') return true;
    const prov = String(src.billing_provider ?? src.billingProvider ?? src.provider ?? '').trim().toLowerCase();
    if (prov && (ZERO_MARGINAL_PROVIDERS.has(prov) || prov.includes('chatgpt-sub') || prov.includes('opencodex'))) {
      return true;
    }
    const bUrl = src.billing_base_url ?? src.billingBaseUrl ?? src.base_url ?? src.baseUrl ?? '';
    if (isPrivateOrLoopbackUrl(bUrl)) return true;
  }
  return false;
}

function resolveModelRates(entryRates, promptTokens, nowMs) {
  let [inRate, outRate, cacheRate, opts] = entryRates;
  let cacheWriteRate = null;
  if (opts && typeof opts === 'object') {
    if (opts.effectiveAtMs != null && Array.isArray(opts.nextRates) && nowMs >= opts.effectiveAtMs) {
      [inRate, outRate, cacheRate] = opts.nextRates;
    }
    if (opts.tierThresholdTokens != null && Array.isArray(opts.aboveRates) && promptTokens > opts.tierThresholdTokens) {
      [inRate, outRate, cacheRate] = opts.aboveRates;
    }
    if (typeof opts.cacheWriteRate === 'number' && Number.isFinite(opts.cacheWriteRate)) {
      cacheWriteRate = opts.cacheWriteRate;
    }
  }
  return [inRate, outRate, cacheRate, cacheWriteRate ?? inRate * 1.25];
}

function estimateRawTokensUsd(
  input,
  output,
  modelName,
  cacheRead = null,
  cacheHitPct = null,
  reasoning = 0,
  total = null,
  nowMs = Date.now(),
  cacheWrite = null,
  calls = null
) {
  const rawIn = Math.max(0, input ?? 0);
  const o = Math.max(0, output ?? 0);
  const cWr = Math.max(0, cacheWrite ?? 0);
  const hasExplicitCache = cacheRead != null && Number.isFinite(cacheRead) && cacheRead >= 0;
  const cRd = hasExplicitCache ? cacheRead : 0;
  if (rawIn === 0 && o === 0 && cRd === 0 && cWr === 0) return null;
  if (!modelName) return null;
  const matched = MODEL_PRICING.find(([re]) => re.test(modelName));
  if (!matched) return null;

  // Hermes normalizes `input` / `input_tokens` to UNCACHED fresh input (already excluding
  // `cache_read_tokens` and `cache_write_tokens`). Never subtract `cacheRead` from `input` again.
  // Only split `rawIn` by `cacheHitPct` when no explicit `cacheRead` bucket was provided.
  let freshIn = rawIn;
  let cachedIn = cRd;
  if (!hasExplicitCache && cacheHitPct != null && cacheHitPct > 0) {
    const ratio = Math.min(1, Math.max(0, cacheHitPct / 100));
    cachedIn = rawIn * ratio;
    freshIn = Math.max(0, rawIn - cachedIn);
  }

  const promptTotal = freshIn + cachedIn + cWr;
  const callCount = toNum(calls);
  const perCallPrompt = callCount != null && callCount > 1 ? promptTotal / callCount : promptTotal;
  const [inRate, outRate, cacheRate, cacheWriteRate] = resolveModelRates(matched[1], perCallPrompt, nowMs);
  const r = Math.max(0, reasoning ?? 0);
  const reasoningExtra = r > 0 && total != null && total >= promptTotal + o + r ? r : 0;
  return (
    freshIn * inRate +
    cachedIn * cacheRate +
    cWr * cacheWriteRate +
    (o + reasoningExtra) * outRate
  ) / 1e6;
}

function extractSourceTokenBuckets(src) {
  if (!src || typeof src !== 'object') {
    return { input: null, cacheRead: null, cacheWrite: null, promptTokens: null, hasAny: false };
  }
  const pDetails =
    (src.prompt_tokens_details && typeof src.prompt_tokens_details === 'object'
      ? src.prompt_tokens_details
      : null) ||
    (src.input_tokens_details && typeof src.input_tokens_details === 'object'
      ? src.input_tokens_details
      : null);

  const explicitInput = pickBestNum(src.input, src.input_tokens);
  const promptField = pickBestNum(src.prompt, src.prompt_tokens);
  const explicitCacheRead = pickBestNum(
    src.cache_read_tokens,
    src.cache_read,
    src.cacheRead,
    src.cacheReadTokens,
    src.cache_read_input_tokens,
    src.cached_tokens,
    src.cached_input_tokens,
    pDetails?.cached_tokens,
    pDetails?.cache_read_tokens,
    pDetails?.cache_read_input_tokens
  );
  const cacheWrite = pickBestNum(
    src.cache_write_tokens,
    src.cache_write,
    src.cacheWrite,
    src.cacheWriteTokens,
    src.cache_creation_input_tokens,
    pDetails?.cache_creation_tokens,
    pDetails?.cache_write_tokens,
    pDetails?.cache_creation_input_tokens
  );

  // `tui_usage` (liveUsage / session.info.usage) reports uncached `input` + total `prompt`
  // without a separate `cache_read_tokens` key.
  let input = explicitInput;
  let cacheRead = explicitCacheRead;
  if (cacheRead == null && promptField != null && explicitInput != null) {
    const cw = cacheWrite ?? 0;
    if (promptField > explicitInput + cw) {
      cacheRead = promptField - explicitInput - cw;
    } else if (promptField > 0 && promptField === explicitInput + cw) {
      const srcHitPct = toNum(src.cache_hit_pct ?? src.cacheHitPct);
      if (srcHitPct != null && srcHitPct >= 100) {
        input = 0;
        cacheRead = Math.max(0, promptField - cw);
      } else {
        // Explicit 0% cache hit (`prompt === input`): pin cacheRead = 0 so downstream never re-splits by stale cacheHitPct.
        cacheRead = 0;
      }
    }
  }

  // Raw OpenAI-shaped payloads with `prompt_tokens` + `cached_input_tokens` (no `input_tokens`):
  // derive uncached fresh `input` by subtracting cache buckets once.
  if (input == null && promptField != null) {
    input = Math.max(0, promptField - (cacheRead ?? 0) - (cacheWrite ?? 0));
  }

  let promptTokens = null;
  if (input != null || cacheRead != null || cacheWrite != null) {
    const sumPrompt = (input ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
    promptTokens = promptField != null ? Math.max(promptField, sumPrompt) : sumPrompt;
  } else if (promptField != null) {
    promptTokens = promptField;
  }

  const hasAny = input != null || cacheRead != null || cacheWrite != null || promptTokens != null;
  return { input, cacheRead, cacheWrite, promptTokens, hasAny };
}

function selectAuthoritativePromptBucket(...buckets) {
  let chosen = null;
  for (const b of buckets) {
    if (!b || !b.hasAny) continue;
    if (!chosen) {
      chosen = b;
      continue;
    }
    const curP = chosen.promptTokens ?? 0;
    const nextP = b.promptTokens ?? 0;
    if (nextP > curP) {
      chosen = b;
    } else if (nextP === curP && chosen.cacheRead == null && b.cacheRead != null) {
      chosen = b;
    }
  }
  return chosen || { input: null, cacheRead: null, cacheWrite: null, promptTokens: null, hasAny: false };
}

function mergeUsageSources(liveUsage, rpcUsage, persistedSession, breakdown) {
  const a = liveUsage && typeof liveUsage === 'object' ? liveUsage : {};
  const b = rpcUsage && typeof rpcUsage === 'object' ? rpcUsage : {};
  const ps = persistedSession && typeof persistedSession === 'object' ? persistedSession : {};
  const bd = breakdown && typeof breakdown === 'object' ? breakdown : {};

  const bucketA = extractSourceTokenBuckets(a);
  const bucketB = extractSourceTokenBuckets(b);
  const bucketPs = extractSourceTokenBuckets(ps);

  // Pick a single coherent source bucket (highest prompt watermark, priority live > rpc > persisted)
  // rather than mixing `input` from one shape with `cacheRead` from another.
  const bestBucket = selectAuthoritativePromptBucket(bucketA, bucketB, bucketPs);
  const input = bestBucket.input;
  const cacheRead = bestBucket.cacheRead;
  const cacheWrite = bestBucket.cacheWrite;
  const promptTokens = bestBucket.promptTokens;

  const output = pickBestNum(
    a.output, a.output_tokens, a.completion, a.completion_tokens,
    b.output, b.output_tokens, b.completion, b.completion_tokens,
    ps.output_tokens, ps.completion_tokens
  );
  const reasoning = pickBestNum(a.reasoning, a.reasoning_tokens, b.reasoning, b.reasoning_tokens, ps.reasoning_tokens);
  const rawTotal = pickBestNum(a.total, a.total_tokens, b.total, b.total_tokens, ps.total_tokens);
  const billedSum =
    promptTokens != null || output != null ? (promptTokens ?? (input || 0)) + (output || 0) : null;
  const total =
    billedSum != null && rawTotal != null
      ? Math.max(billedSum, rawTotal)
      : (billedSum ?? rawTotal);
  const calls = pickBestNum(a.calls, a.api_calls, b.calls, b.api_calls, ps.api_calls, ps.api_call_count);

  const bdCatSum = Array.isArray(bd.categories)
    ? bd.categories.reduce((acc, c) => acc + (toNum(c?.tokens) ?? 0), 0)
    : 0;
  const ctxMax = pickBestNum(bd.context_max, a.context_max, b.context_max, b.context_length);
  const ctxUsed = pickBestNum(
    bd.context_used, a.context_used, b.context_used, b.last_prompt_tokens,
    bdCatSum > 0 ? bdCatSum : null
  );
  const ctxPct =
    ctxUsed != null && ctxMax && ctxMax > 0
      ? Math.max(0, Math.min(100, (ctxUsed / ctxMax) * 100))
      : pickBestNum(bd.context_percent, a.context_percent, b.context_percent);

  const directCachePct = pickBestNum(a.cache_hit_pct, a.cacheHitPct, b.cache_hit_pct, b.cacheHitPct);
  const derivedCachePct =
    cacheRead != null && cacheRead > 0 && promptTokens && promptTokens > 0
      ? Math.max(0, Math.min(100, Math.round((cacheRead / promptTokens) * 100)))
      : null;
  const cacheHitPct =
    directCachePct != null && directCachePct > 0
      ? directCachePct
      : derivedCachePct ?? directCachePct;

  const compressions = pickBestNum(a.compressions, b.compressions, b.compression_count, bd.compressions, ps.compression_count);
  const avgTps = pickBestNum(a.avg_tps, a.tokens_per_s, b.avg_tps, b.tokens_per_s);
  const avgLatency = pickBestNum(a.avg_latency_s, b.avg_latency_s);
  const directBackendCost = pickBestNum(
    a.actual_cost_usd, a.cost_usd, a.estimated_cost_usd,
    b.actual_cost_usd, b.cost_usd, b.estimated_cost_usd,
    ps.actual_cost_usd, ps.cost_usd, ps.estimated_cost_usd
  );
  const hasUsageActivity =
    (input ?? 0) > 0 ||
    (cacheRead ?? 0) > 0 ||
    (cacheWrite ?? 0) > 0 ||
    (output ?? 0) > 0 ||
    (calls ?? 0) > 0;
  const backendCost =
    directBackendCost != null
      ? directBackendCost
      : hasUsageActivity && isZeroMarginalCostSource(a, b, ps)
        ? 0
        : null;

  return {
    input,
    cacheRead,
    cacheWrite,
    promptTokens,
    output,
    reasoning,
    total,
    calls,
    ctxUsed,
    ctxMax,
    ctxPct,
    cacheHitPct,
    compressions,
    avgTps,
    avgLatency,
    backendCost,
  };
}

function estimateSessionCost(merged, modelName, ...routeHints) {
  if (merged.backendCost != null) return { amount: merged.backendCost, estimated: false };
  const hasTok =
    (merged.input ?? 0) > 0 ||
    (merged.cacheRead ?? 0) > 0 ||
    (merged.cacheWrite ?? 0) > 0 ||
    (merged.output ?? 0) > 0;
  if (hasTok && isZeroMarginalCostSource(...routeHints)) {
    return { amount: 0, estimated: false };
  }
  const usd = estimateRawTokensUsd(
    merged.input,
    merged.output,
    modelName,
    merged.cacheRead,
    merged.cacheHitPct,
    merged.reasoning,
    merged.total,
    Date.now(),
    merged.cacheWrite,
    merged.calls
  );
  if (usd == null) return { amount: null, estimated: true };
  return { amount: usd, estimated: true };
}

const LEDGER_STORAGE_KEY = 'usageBaselines.v1';
const LEDGER_FALLBACK_LS_KEY = 'hermes.plugin.hermes-context-bar.usageBaselines.v1';
const LEDGER_MAX_DAYS = 40;

function formatLocalDayKey(epochMs) {
  const d = new Date(epochMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadUsageLedger(ctx) {
  try {
    if (ctx?.storage && typeof ctx.storage.get === 'function') {
      const saved = ctx.storage.get(LEDGER_STORAGE_KEY, null);
      if (saved && typeof saved === 'object' && !Array.isArray(saved) && typeof saved.then !== 'function') {
        return saved;
      }
    }
  } catch {}
  try {
    const raw = globalThis.localStorage?.getItem(LEDGER_FALLBACK_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return {};
}

function saveUsageLedger(ctx, ledger) {
  if (!ledger || typeof ledger !== 'object') return;
  const days = Object.keys(ledger).sort();
  const trimmed = {};
  for (const dayKey of days.slice(-LEDGER_MAX_DAYS)) {
    if (ledger[dayKey] && typeof ledger[dayKey] === 'object') {
      trimmed[dayKey] = ledger[dayKey];
    }
  }
  try {
    if (ctx?.storage && typeof ctx.storage.set === 'function') {
      ctx.storage.set(LEDGER_STORAGE_KEY, trimmed);
      return;
    }
  } catch {}
  try {
    globalThis.localStorage?.setItem(LEDGER_FALLBACK_LS_KEY, JSON.stringify(trimmed));
  } catch {}
}

function lookupLedgerBaseline(ledger, cutoffDayKey, sessionKey) {
  if (!ledger || typeof ledger !== 'object' || !cutoffDayKey || !sessionKey) return null;
  const priorDays = Object.keys(ledger)
    .filter((d) => d < cutoffDayKey)
    .sort();
  for (let i = priorDays.length - 1; i >= 0; i--) {
    const snap = ledger[priorDays[i]]?.[sessionKey];
    if (snap && typeof snap === 'object') return snap;
  }
  return null;
}

function recordLedgerObservation(ledger, dayKey, sessionKey, cur) {
  if (!ledger || typeof ledger !== 'object' || !dayKey || !sessionKey) return false;
  const bucket = ledger[dayKey] && typeof ledger[dayKey] === 'object' ? ledger[dayKey] : {};
  const prev = bucket[sessionKey];
  const next = {
    input: Math.max(prev?.input ?? 0, cur.input ?? 0),
    cacheRead: Math.max(prev?.cacheRead ?? 0, cur.cacheRead ?? 0),
    cacheWrite: Math.max(prev?.cacheWrite ?? 0, cur.cacheWrite ?? 0),
    output: Math.max(prev?.output ?? 0, cur.output ?? 0),
    costUsd:
      cur.costUsd != null || prev?.costUsd != null
        ? Math.max(prev?.costUsd ?? 0, cur.costUsd ?? 0)
        : null,
  };
  const changed =
    !prev ||
    prev.input !== next.input ||
    prev.cacheRead !== next.cacheRead ||
    prev.cacheWrite !== next.cacheWrite ||
    prev.output !== next.output ||
    prev.costUsd !== next.costUsd;
  if (changed) {
    ledger[dayKey] = { ...bucket, [sessionKey]: next };
  }
  return changed;
}

function aggregatePersistedSessions(
  sessions,
  timeRange,
  activeCandidateIds,
  liveMerged,
  liveModelName,
  nowMs = Date.now(),
  ...liveRouteHints
) {
  // Optional trailing options bag (keeps 100% backward-compatible signature for existing callers)
  let aggOpts = null;
  if (
    liveRouteHints.length > 0 &&
    liveRouteHints[liveRouteHints.length - 1] &&
    typeof liveRouteHints[liveRouteHints.length - 1] === 'object' &&
    liveRouteHints[liveRouteHints.length - 1].__aggOpts === true
  ) {
    aggOpts = liveRouteHints.pop();
  }
  const activeProfileSlug = aggOpts?.activeProfileSlug || null;
  const ledger = aggOpts?.ledger || null;
  const mutateLedger = aggOpts?.mutateLedger !== false;
  const liveSidAligned = aggOpts?.liveSidAligned !== false;
  const connScopeKey = aggOpts?.connScopeKey || 'local';

  const cutoffMs = getTimeRangeCutoffMs(timeRange, nowMs);
  const cutoffDayKey = cutoffMs > 0 ? formatLocalDayKey(cutoffMs) : '';
  const todayDayKey = formatLocalDayKey(nowMs);
  const activeSet = new Set((activeCandidateIds || []).filter(Boolean));
  const allByKey = new Map();

  for (const s of sessions) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || s.session_id || '');
    if (!id) continue;
    const sProf = String(s._profile || s.profile || '').trim();
    const dedupKey = sProf ? `${sProf}:${id}` : id;
    if (!allByKey.has(dedupKey)) allByKey.set(dedupKey, { id, sProf, row: s });
  }

  let input = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let output = 0;
  let costUsd = 0;
  let hasAnyCost = false;
  let anyEstimated = false;
  let matchedActive = false;
  let ledgerDirty = false;
  let sessionCount = 0;
  const observations = [];

  const sumLineageAncestors = (startParentId, sProf) => {
    let ancIn = 0;
    let ancCr = 0;
    let ancCw = 0;
    let ancOut = 0;
    let ancRsn = 0;
    let ancCalls = 0;
    let ancCost = 0;
    let curPid = String(startParentId || '').trim();
    const visited = new Set();
    while (curPid && !visited.has(curPid)) {
      visited.add(curPid);
      const ancKey = sProf ? `${sProf}:${curPid}` : curPid;
      const ancEntry = allByKey.get(ancKey) || allByKey.get(curPid);
      if (!ancEntry?.row) break;
      const ar = ancEntry.row;
      if (ar.end_reason && String(ar.end_reason) !== 'compression') break;
      const ab = extractSourceTokenBuckets(ar);
      const aIn = ab.input ?? 0;
      const aCr = ab.cacheRead ?? 0;
      const aCw = ab.cacheWrite ?? 0;
      const aOut = toNum(ar.output_tokens ?? ar.output ?? ar.completion_tokens) ?? 0;
      const aRsn = toNum(ar.reasoning_tokens ?? ar.reasoning) ?? 0;
      const aCalls = pickBestNum(ar.api_call_count, ar.api_calls, ar.calls) ?? 0;
      let aCost = pickBestNum(ar.actual_cost_usd, ar.cost_usd, ar.estimated_cost_usd);
      if (aCost == null && (aIn > 0 || aCr > 0 || aCw > 0 || aOut > 0) && !isZeroMarginalCostSource(ar)) {
        aCost = estimateRawTokensUsd(aIn, aOut, ar.model || liveModelName, aCr, null, aRsn, null, nowMs, aCw, aCalls);
      }
      ancIn += aIn;
      ancCr += aCr;
      ancCw += aCw;
      ancOut += aOut;
      ancRsn += aRsn;
      ancCalls += aCalls;
      ancCost += aCost ?? 0;
      curPid = String(ar.parent_session_id || '').trim();
    }
    return {
      ancIn,
      ancCr,
      ancCw,
      ancOut,
      ancRsn,
      ancCalls,
      ancCost,
      ancPrompt: ancIn + ancCr + ancCw,
    };
  };

  for (const [, entry] of allByKey.entries()) {
    const { id, sProf, row: s } = entry;
    const isAux = Boolean(s._is_aux);
    const isFocusedActive =
      !isAux &&
      liveSidAligned &&
      activeSet.has(id) &&
      (!activeProfileSlug || !sProf || sProf === activeProfileSlug);

    const rowBuckets = extractSourceTokenBuckets(s);
    let sIn = rowBuckets.input ?? 0;
    let sCr = rowBuckets.cacheRead ?? 0;
    let sCw = rowBuckets.cacheWrite ?? 0;
    let sOut = toNum(s.output_tokens ?? s.output ?? s.completion_tokens) ?? 0;
    let sRsn = toNum(s.reasoning_tokens ?? s.reasoning) ?? 0;
    let sCalls = pickBestNum(s.api_call_count, s.api_calls, s.calls);
    let sCost = pickBestNum(s.actual_cost_usd, s.cost_usd, s.estimated_cost_usd);
    let sEst = String(s.cost_status || '').toLowerCase() === 'estimated';

    if (isFocusedActive && liveMerged) {
      matchedActive = true;
      // Hermes runtime `session_*_tokens` accumulate across auto-compression rotations (`parent_session_id`),
      // whereas `/ledger` includes each persisted ancestor segment separately. Subtract present ancestors
      // when `liveMerged` carries the full-chain watermark (`livePrompt >= ancPrompt`) so ancestors are never double-billed!
      const anc = s.parent_session_id ? sumLineageAncestors(s.parent_session_id, sProf) : null;
      const livePrompt =
        (liveMerged.input ?? 0) + (liveMerged.cacheRead ?? 0) + (liveMerged.cacheWrite ?? 0);
      const deductAnc = Boolean(anc && anc.ancPrompt > 0 && livePrompt >= anc.ancPrompt);

      const effLiveIn = deductAnc ? Math.max(0, (liveMerged.input ?? 0) - anc.ancIn) : (liveMerged.input ?? 0);
      const effLiveCr = deductAnc ? Math.max(0, (liveMerged.cacheRead ?? 0) - anc.ancCr) : (liveMerged.cacheRead ?? 0);
      const effLiveCw = deductAnc ? Math.max(0, (liveMerged.cacheWrite ?? 0) - anc.ancCw) : (liveMerged.cacheWrite ?? 0);
      const effLiveOut = deductAnc ? Math.max(0, (liveMerged.output ?? 0) - anc.ancOut) : (liveMerged.output ?? 0);
      const effLiveRsn = deductAnc ? Math.max(0, (liveMerged.reasoning ?? 0) - anc.ancRsn) : (liveMerged.reasoning ?? 0);
      const effLiveCalls =
        liveMerged.calls != null
          ? (deductAnc ? Math.max(0, liveMerged.calls - anc.ancCalls) : liveMerged.calls)
          : null;
      const effLiveCost =
        liveMerged.backendCost != null
          ? (deductAnc ? Math.max(0, liveMerged.backendCost - anc.ancCost) : liveMerged.backendCost)
          : null;

      const liveAdvanced =
        effLiveIn > sIn ||
        effLiveCr > sCr ||
        effLiveCw > sCw ||
        effLiveOut > sOut;
      sIn = Math.max(sIn, effLiveIn);
      sCr = Math.max(sCr, effLiveCr);
      sCw = Math.max(sCw, effLiveCw);
      sOut = Math.max(sOut, effLiveOut);
      sRsn = Math.max(sRsn, effLiveRsn);
      sCalls = Math.max(sCalls ?? 0, effLiveCalls ?? 0) || sCalls;
      if (effLiveCost != null) {
        sCost = Math.max(sCost ?? 0, effLiveCost);
      } else if (liveAdvanced && sCost != null && !isZeroMarginalCostSource(s, ...liveRouteHints)) {
        const refreshedEst = estimateRawTokensUsd(
          sIn,
          sOut,
          s.model || liveModelName,
          sCr,
          null,
          sRsn,
          null,
          nowMs,
          sCw,
          sCalls
        );
        if (refreshedEst != null && refreshedEst > sCost) {
          sCost = refreshedEst;
          sEst = true;
        }
      }
    }

    const effectiveModel = s.model || (isFocusedActive ? liveModelName : '');
    if (sCost == null && (sIn > 0 || sCr > 0 || sCw > 0 || sOut > 0)) {
      if (isZeroMarginalCostSource(s, ...(isFocusedActive ? liveRouteHints : []))) {
        sCost = 0;
      } else {
        const est = estimateRawTokensUsd(
          sIn,
          sOut,
          effectiveModel,
          sCr,
          null,
          sRsn,
          null,
          nowMs,
          sCw,
          sCalls
        );
        if (est != null) {
          sCost = est;
          sEst = true;
        }
      }
    }

    const ledgerKey = `${connScopeKey}:${sProf || activeProfileSlug || 'default'}:${id}`;
    // Record watermarks BEFORE cutoffMs filtering so dormant older sessions anchor their pre-today baseline immediately!
    if (sIn > 0 || sCr > 0 || sCw > 0 || sOut > 0 || (sCost ?? 0) > 0) {
      const snap = {
        input: sIn,
        cacheRead: sCr,
        cacheWrite: sCw,
        output: sOut,
        costUsd: sCost,
      };
      observations.push({ dayKey: todayDayKey, sessionKey: ledgerKey, snapshot: snap });
      if (ledger && mutateLedger) {
        if (recordLedgerObservation(ledger, todayDayKey, ledgerKey, snap)) {
          ledgerDirty = true;
        }
      }
    }

    const ts =
      toEpochMs(s.last_active ?? s.last_activity_at ?? s.last_active_at) ??
      toEpochMs(s.started_at);
    if (cutoffMs > 0 && (ts == null || ts < cutoffMs)) continue;

    // Cross-day forever-chat delta slicing when a prior-day baseline exists
    const startedMs = toEpochMs(s.started_at);
    if (ledger && cutoffMs > 0 && startedMs != null && startedMs < cutoffMs) {
      const base = lookupLedgerBaseline(ledger, cutoffDayKey, ledgerKey);
      if (base) {
        sIn = Math.max(0, sIn - (base.input ?? 0));
        sCr = Math.max(0, sCr - (base.cacheRead ?? 0));
        sCw = Math.max(0, sCw - (base.cacheWrite ?? 0));
        sOut = Math.max(0, sOut - (base.output ?? 0));
        if (sCost != null && base.costUsd != null) {
          sCost = Math.max(0, sCost - base.costUsd);
        }
      }
    }

    if (!isAux) sessionCount += 1;
    input += sIn;
    cacheRead += sCr;
    cacheWrite += sCw;
    output += sOut;
    if (sCost != null) {
      costUsd += sCost;
      hasAnyCost = true;
      if (sEst) anyEstimated = true;
    }
  }

  const primaryActiveId = activeCandidateIds?.[0] || '';
  const includeActiveLiveFallback =
    aggOpts?.includeActiveLive !== false &&
    liveSidAligned &&
    primaryActiveId &&
    !matchedActive &&
    liveMerged &&
    ((liveMerged.input ?? 0) > 0 ||
      (liveMerged.cacheRead ?? 0) > 0 ||
      (liveMerged.cacheWrite ?? 0) > 0 ||
      (liveMerged.output ?? 0) > 0 ||
      (liveMerged.backendCost ?? 0) > 0);

  if (includeActiveLiveFallback) {
    sessionCount += 1;
    input += liveMerged.input ?? 0;
    cacheRead += liveMerged.cacheRead ?? 0;
    cacheWrite += liveMerged.cacheWrite ?? 0;
    output += liveMerged.output ?? 0;
    const liveCost = estimateSessionCost(liveMerged, liveModelName, ...liveRouteHints);
    if (liveCost.amount != null) {
      costUsd += liveCost.amount;
      hasAnyCost = true;
      if (liveCost.estimated) anyEstimated = true;
    }
  }

  const promptTokens = input + cacheRead + cacheWrite;
  return {
    input,
    cacheRead,
    cacheWrite,
    promptTokens,
    output,
    total: promptTokens + output,
    sessionCount,
    costUsd: hasAnyCost ? costUsd : null,
    estimated: anyEstimated,
    ledgerDirty,
    observations,
  };
}

function normalizeCategories(breakdown, skin, t) {
  const raw = Array.isArray(breakdown?.categories) ? breakdown.categories : [];
  return raw
    .map((c, idx) => {
      const id = String(c?.id || `cat-${idx}`);
      const tokens = toNum(c?.tokens) ?? 0;
      return {
        id,
        label: t.cat[id] || String(c?.label || id),
        prismColor: CATEGORY_COLORS[id] || PRISM_FALLBACK_COLORS[idx % PRISM_FALLBACK_COLORS.length],
        tokens,
      };
    })
    .filter((c) => c.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .map((c, rank) => ({
      ...c,
      color: skin === 'prism' ? c.prismColor : 'var(--foreground, #18181b)',
      opacity: skin === 'prism' ? 1 : MONO_OPACITIES[Math.min(rank, MONO_OPACITIES.length - 1)],
    }));
}

function isLocalRouteMode(obj) {
  const mode = String(obj?.mode || obj?.connectionKind || '').trim().toLowerCase();
  if (mode === 'local') return true;
  if (mode === 'remote') return false;
  const cid = String(obj?.connectionId || '').trim();
  return !cid || cid === 'local';
}

function resolveRoute(owner, profileSlug, routeMap = null) {
  const profile = String(owner?.profile || profileSlug || 'default').trim() || 'default';
  const connId = String(owner?.connectionId || '').trim();
  if (routeMap && typeof routeMap === 'object') {
    const cached = routeMap[profile];
    if (cached && cached.connectionId && cached.profile && cached.targetProfile) {
      if (!connId || connId === cached.connectionId || (connId === 'local' && cached.mode === 'local')) {
        return cached;
      }
    }
  }
  if (connId) {
    return {
      connectionId: connId,
      mode: isLocalRouteMode(owner) ? 'local' : 'remote',
      profile,
      targetProfile: String(owner?.targetProfile || profile),
    };
  }
  return null;
}

async function loadAsyncRouteMap(connFilter = '', hostObj = host) {
  if (typeof hostObj?.profileRoutes !== 'function') return {};
  try {
    const routes = await Promise.resolve(hostObj.profileRoutes());
    if (!Array.isArray(routes)) return {};
    const map = {};
    for (const r of routes) {
      if (!r || !r.connectionId || !r.profile || !r.targetProfile) continue;
      const cid = String(r.connectionId).trim();
      const mode = isLocalRouteMode(r) ? 'local' : 'remote';
      if (connFilter && connFilter !== 'local' && cid !== connFilter) continue;
      if (connFilter === 'local' && mode !== 'local') continue;
      const norm = {
        connectionId: cid,
        mode,
        profile: String(r.profile).trim(),
        targetProfile: String(r.targetProfile).trim(),
      };
      map[norm.profile] = norm;
      map[norm.targetProfile] = norm;
    }
    return map;
  } catch {
    return {};
  }
}

async function gwCall(route, method, params = {}, profileHint = '', hostObj = host) {
  const targetProf = String(route?.targetProfile || route?.profile || profileHint || '').trim();
  const activeProf = String(hostObj?.state?.profile?.get?.() || 'default').trim();
  const activeConn = String(
    hostObj?.state?.connectionId?.get?.() ||
      (typeof hostObj?.activeConnectionId === 'function' ? hostObj.activeConnectionId() : '') ||
      ''
  ).trim();

  const canFallbackToActiveSocket = (err) => {
    // Never replay a request that already reached the target gateway and received a JSON-RPC error code
    if (typeof err?.code === 'number') return false;
    if (targetProf && targetProf !== activeProf) return false;
    const rConn = String(route?.connectionId || '').trim();
    if (rConn) {
      const sameLocal = (rConn === 'local' || route?.mode === 'local') && (!activeConn || activeConn === 'local');
      if (!sameLocal && rConn !== activeConn) return false;
    }
    return true;
  };

  if (typeof hostObj?.requestProfile === 'function') {
    if (route) {
      try {
        return await hostObj.requestProfile(route, method, params);
      } catch (err) {
        if (!canFallbackToActiveSocket(err)) throw err;
      }
    } else if (targetProf) {
      try {
        return await hostObj.requestProfile(targetProf, method, params);
      } catch (err) {
        if (!canFallbackToActiveSocket(err)) throw err;
      }
    }
  }
  if (typeof hostObj?.request === 'function') {
    if (!canFallbackToActiveSocket(null)) {
      throw new Error(`Cannot route ${method} for "${targetProf || 'default'}" without requestProfile`);
    }
    return hostObj.request(method, params);
  }
  throw new Error('Hermes gateway unavailable');
}

function synthesizeCanonicalSessionRow(sessionId, profileName, payload, canonicalMeta = null, profileMeta = null) {
  if (!sessionId || !payload || typeof payload !== 'object') return null;
  const usageObj = payload.usage && typeof payload.usage === 'object' ? payload.usage : payload;
  const buckets = extractSourceTokenBuckets(usageObj);
  const output = pickBestNum(
    usageObj.output,
    usageObj.output_tokens,
    usageObj.completion,
    usageObj.completion_tokens,
    payload.output_tokens
  ) ?? 0;
  const reasoning = pickBestNum(
    usageObj.reasoning,
    usageObj.reasoning_tokens,
    payload.reasoning_tokens
  ) ?? 0;
  const model = String(
    usageObj.model || payload.model || profileMeta?.model || ''
  ).trim();
  const provider = String(
    usageObj.provider || payload.provider || profileMeta?.provider || ''
  ).trim();
  const startedAt =
    payload.started_at ?? canonicalMeta?.started_at ?? null;
  const lastActive =
    payload.last_active_at ??
    payload.last_activity_at ??
    payload.last_active ??
    canonicalMeta?.last_active ??
    startedAt;
  const directCost = pickBestNum(
    usageObj.actual_cost_usd,
    usageObj.cost_usd,
    usageObj.estimated_cost_usd,
    payload.actual_cost_usd,
    payload.cost_usd,
    payload.estimated_cost_usd
  );

  return {
    id: String(sessionId),
    _profile: String(profileName),
    profile: String(profileName),
    source: String(payload.source || 'local'),
    hidden: true,
    title: String(payload.title || canonicalMeta?.title || 'Bot Chat'),
    model,
    provider,
    billing_provider: provider,
    started_at: startedAt,
    last_active: lastActive,
    api_call_count: pickBestNum(usageObj.calls, usageObj.api_calls, payload.api_call_count) ?? 0,
    input_tokens: buckets.input ?? 0,
    cache_read_tokens: buckets.cacheRead ?? 0,
    cache_write_tokens: buckets.cacheWrite ?? 0,
    output_tokens: output,
    reasoning_tokens: reasoning,
    ...(directCost != null ? { estimated_cost_usd: directCost, cost_status: 'estimated' } : {}),
  };
}

async function fetchBackendLedger(ctx) {
  if (typeof ctx?.rest !== 'function') return null;
  try {
    const res = await ctx.rest('/ledger');
    if (!res || typeof res !== 'object' || !Array.isArray(res.entries)) return null;
    const names = [];
    const titles = {};
    const metaByProfile = {};
    if (Array.isArray(res.profiles)) {
      for (const p of res.profiles) {
        if (!p || typeof p !== 'object') continue;
        const name = String(p.name || '').trim();
        if (!name) continue;
        names.push(name);
        if (p.title) titles[name] = String(p.title).trim();
        if (p.model || p.provider || p.base_url) {
          metaByProfile[name] = {
            model: String(p.model || '').trim(),
            provider: String(p.provider || '').trim(),
            base_url: String(p.base_url || '').trim(),
          };
        }
      }
    }
    return {
      names: Array.from(new Set(names)).sort(),
      titles,
      metaByProfile,
      entries: res.entries,
    };
  } catch {
    return null;
  }
}

function extractFocusedSessionFromLedger(entries, candidateIds, profileSlug) {
  if (!Array.isArray(entries) || !Array.isArray(candidateIds) || candidateIds.length === 0) return null;
  const idSet = new Set(candidateIds.filter(Boolean));
  const prof = String(profileSlug || 'default').trim() || 'default';
  const profEntries = entries.filter(
    (e) => e && typeof e === 'object' && !e._is_aux && String(e._profile || e.profile || 'default').trim() === prof
  );
  const byId = new Map();
  for (const e of profEntries) {
    const eid = String(e.id || e.session_id || '').trim();
    if (eid) byId.set(eid, e);
  }
  let tip = null;
  for (const cid of idSet) {
    if (byId.has(cid)) {
      tip = byId.get(cid);
      break;
    }
  }
  if (!tip) return null;

  let input = toNum(tip.input_tokens) ?? 0;
  let cacheRead = toNum(tip.cache_read_tokens) ?? 0;
  let cacheWrite = toNum(tip.cache_write_tokens) ?? 0;
  let output = toNum(tip.output_tokens) ?? 0;
  let reasoning = toNum(tip.reasoning_tokens) ?? 0;
  let calls = toNum(tip.api_call_count) ?? 0;
  let cost = pickBestNum(tip.actual_cost_usd, tip.cost_usd, tip.estimated_cost_usd);
  let hasCost = cost != null;
  let totalCost = cost ?? 0;
  let compressions = 0;

  let curPid = String(tip.parent_session_id || '').trim();
  const visited = new Set([String(tip.id || '')]);
  while (curPid && !visited.has(curPid)) {
    visited.add(curPid);
    const anc = byId.get(curPid);
    if (!anc) break;
    if (anc.end_reason && String(anc.end_reason) !== 'compression') break;
    compressions += 1;
    input += toNum(anc.input_tokens) ?? 0;
    cacheRead += toNum(anc.cache_read_tokens) ?? 0;
    cacheWrite += toNum(anc.cache_write_tokens) ?? 0;
    output += toNum(anc.output_tokens) ?? 0;
    reasoning += toNum(anc.reasoning_tokens) ?? 0;
    calls += toNum(anc.api_call_count) ?? 0;
    const ancCost = pickBestNum(anc.actual_cost_usd, anc.cost_usd, anc.estimated_cost_usd);
    if (ancCost != null) {
      totalCost += ancCost;
      hasCost = true;
    }
    curPid = String(anc.parent_session_id || '').trim();
  }

  return {
    ...tip,
    input_tokens: input,
    cache_read_tokens: cacheRead,
    cache_write_tokens: cacheWrite,
    output_tokens: output,
    reasoning_tokens: reasoning,
    api_call_count: calls,
    ...(compressions > 0 ? { compression_count: compressions } : {}),
    ...(hasCost ? { estimated_cost_usd: totalCost } : {}),
  };
}

async function discoverConnectionRoster({
  effectiveConnId = '',
  routeMap = null,
  gwCallFn = gwCall,
  hostObj = host,
} = {}) {
  const namesSet = new Set();
  const titles = {};
  const canonicalByProfile = {};
  const metaByProfile = {};
  const routes = {};

  let primaryConnId =
    typeof hostObj?.primaryConnectionId === 'function'
      ? String(hostObj.primaryConnectionId() || '').trim()
      : '';

  const matchesConn = (item) => {
    const cid = String(item?.connectionId || '').trim();
    if (effectiveConnId && effectiveConnId !== 'local') {
      return cid === effectiveConnId;
    }
    return !cid || cid === 'local' || isLocalRouteMode(item) || (primaryConnId && cid === primaryConnId);
  };

  const ingestProfileRow = (p, isAgentRoster = false) => {
    if (!p || typeof p !== 'object') return;
    if (isAgentRoster && p.connectionId !== undefined && !matchesConn(p)) return;
    const rawName = String(p.targetProfile || p.profile || p.name || '').trim();
    if (!rawName) return;
    namesSet.add(rawName);
    if (isAgentRoster && p.connectionId) {
      const rNorm = {
        connectionId: String(p.connectionId).trim(),
        mode: isLocalRouteMode(p) ? 'local' : 'remote',
        profile: String(p.profile || rawName).trim(),
        targetProfile: rawName,
      };
      routes[rNorm.profile] = rNorm;
      routes[rNorm.targetProfile] = rNorm;
    }
    const title = String(
      p.ui_meta?.['hermes-bots']?.title || p.bot_title || p.displayName || p.display_name || ''
    ).trim();
    if (title) titles[rawName] = title;
    if (p.model || p.provider) {
      metaByProfile[rawName] = {
        model: String(p.model || metaByProfile[rawName]?.model || '').trim(),
        provider: String(p.provider || metaByProfile[rawName]?.provider || '').trim(),
      };
    }
    const canon = p.canonical_session;
    if (canon && typeof canon === 'object' && (canon.id || canon.resolved_id)) {
      canonicalByProfile[rawName] = canon;
    }
  };

  const tasks = [];

  if (typeof hostObj?.agents === 'function') {
    tasks.push(
      Promise.resolve()
        .then(() => hostObj.agents())
        .then((res) => {
          if (typeof res?.primaryConnectionId === 'string' && res.primaryConnectionId.trim()) {
            primaryConnId = res.primaryConnectionId.trim();
          }
          const list = Array.isArray(res?.agents) ? res.agents : Array.isArray(res) ? res : [];
          for (const item of list) ingestProfileRow(item, true);
        })
        .catch(() => {})
    );
  }

  // Always query `profiles.list` against `default` (the launch root) rather than an isolated
  // secondary profile whose `scope_to_launch_profile` filter only returns itself!
  const defaultRoute = resolveRoute(
    { connectionId: effectiveConnId, profile: 'default' },
    'default',
    { ...(routeMap || {}), ...routes }
  );
  tasks.push(
    Promise.resolve()
      .then(() => gwCallFn(defaultRoute, 'profiles.list', { include_sessions: true }, 'default'))
      .then((res) => {
        if (Array.isArray(res?.profiles)) {
          for (const p of res.profiles) ingestProfileRow(p, false);
        }
      })
      .catch(() => {})
  );

  if (!effectiveConnId || effectiveConnId === 'local') {
    if (typeof hostObj?.profiles?.list === 'function') {
      tasks.push(
        Promise.resolve()
          .then(() => hostObj.profiles.list())
          .then((res) => {
            const list = Array.isArray(res?.profiles) ? res.profiles : Array.isArray(res) ? res : [];
            for (const p of list) ingestProfileRow(p, false);
          })
          .catch(() => {})
      );
    }
  }

  await Promise.all(tasks);
  return {
    names: Array.from(namesSet).sort(),
    titles,
    canonicalByProfile,
    metaByProfile,
    routes,
  };
}

function keepHigherSessionWatermark(prevRow, nextRow) {
  if (!prevRow || typeof prevRow !== 'object') return nextRow;
  if (!nextRow || typeof nextRow !== 'object') return prevRow;
  const prevTok =
    (prevRow.input_tokens ?? 0) + (prevRow.cache_read_tokens ?? 0) + (prevRow.output_tokens ?? 0);
  const nextTok =
    (nextRow.input_tokens ?? 0) + (nextRow.cache_read_tokens ?? 0) + (nextRow.output_tokens ?? 0);
  return nextTok >= prevTok ? nextRow : prevRow;
}

async function collectProfileSessionsForScope({
  targetProfiles,
  connScopeKey = 'local',
  effectiveConnId = '',
  routeMap = null,
  canonicalByProfile = {},
  metaByProfile = {},
  botChatCache = null,
  activeIds = [],
  forceRefresh = false,
  gwCallFn = gwCall,
  hostObj = host,
}) {
  const activeIdSet = new Set((activeIds || []).filter(Boolean));
  const groupSessionIdsByProfile = {};
  const groupTitlesByProfile = {};
  try {
    const defaultRoute = resolveRoute({ connectionId: effectiveConnId, profile: 'default' }, 'default', routeMap);
    const groupsRes = await gwCallFn(defaultRoute, 'groups.list', {}, 'default');
    const rooms = Array.isArray(groupsRes?.rooms)
      ? groupsRes.rooms
      : Array.isArray(groupsRes?.groups)
        ? groupsRes.groups
        : Array.isArray(groupsRes)
          ? groupsRes
          : [];
    for (const g of rooms) {
      if (!g || typeof g !== 'object') continue;
      const roomId = String(g.id || g.room_id || '').trim();
      const members = Array.isArray(g.members) ? g.members : [];
      for (const m of members) {
        const mProf = String(m?.profile || m?.agent || '').trim();
        if (!mProf) continue;
        const mSid = String(m?.session_id || m?.sessionId || g.session_id || '').trim();
        if (mSid) {
          if (!groupSessionIdsByProfile[mProf]) groupSessionIdsByProfile[mProf] = [];
          groupSessionIdsByProfile[mProf].push(mSid);
        } else if (roomId) {
          if (!groupTitlesByProfile[mProf]) groupTitlesByProfile[mProf] = [];
          groupTitlesByProfile[mProf].push(`Group: ${roomId}`);
        }
      }
    }
  } catch {}

  const batches = await Promise.all(
    (targetProfiles || []).map(async (pName) => {
      const route = resolveRoute({ connectionId: effectiveConnId, profile: pName }, pName, routeMap);
      let persisted = [];
      const childParentMap = new Map();
      const extraSegmentIds = [];

      if (typeof hostObj?.listPersistedSessions === 'function') {
        try {
          const res = await hostObj.listPersistedSessions(route, { profile: pName, limit: 500 });
          if (Array.isArray(res?.sessions)) {
            persisted = res.sessions.map((s) => {
              if (!s || typeof s !== 'object') return s;
              const lineageIds = Array.isArray(s._lineage_ids)
                ? s._lineage_ids.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
              const trueRootId = String(s._lineage_root_id || lineageIds[0] || '').trim();
              // `project_compression_tips` keeps `root`'s token/cost counters while stamping `tip`'s `id`.
              // Restore `id` to `trueRootId` so the root row represents the root segment accurately,
              // then queue subsequent segments (`lineageIds[1..last]`) with `parent_session_id` links!
              if (trueRootId && lineageIds.length > 1) {
                for (let idx = 1; idx < lineageIds.length; idx++) {
                  const childId = lineageIds[idx];
                  const prevId = lineageIds[idx - 1];
                  if (childId && childId !== trueRootId) {
                    childParentMap.set(childId, prevId);
                    extraSegmentIds.push(childId);
                  }
                }
                if (s.id !== trueRootId) {
                  return {
                    ...s,
                    id: trueRootId,
                    end_reason: 'compression',
                    _folded_tip_id: String(s.id || ''),
                    _profile: pName,
                  };
                }
              }
              return { ...s, _profile: pName };
            });
          }
        } catch {}
      }

      const existingIds = new Set();
      for (const s of persisted) {
        if (!s || typeof s !== 'object') continue;
        const sid = String(s.id || s.session_id || '');
        if (sid) existingIds.add(sid);
      }

      const missingLineageChildren = Array.from(new Set(extraSegmentIds)).filter((id) => !existingIds.has(id));

      // Hidden canonical "Bot Chat" rows and group bot_room sessions are excluded by `listPersistedSessions` (`s.hidden = 0`).
      let canon = canonicalByProfile?.[pName] || null;
      if (!canon || (!canon.id && !canon.resolved_id)) {
        try {
          const byTitle = await gwCallFn(
            route,
            'session.list',
            { title: 'Bot Chat', include_hidden: true },
            pName
          );
          const first = Array.isArray(byTitle?.sessions) ? byTitle.sessions[0] : null;
          if (first && (first.id || first.resolved_id)) {
            canon = first;
          }
        } catch {}
      }

      const discoveredGroupIds = [...(groupSessionIdsByProfile[pName] || [])];
      for (const gTitle of groupTitlesByProfile[pName] || []) {
        try {
          const gRes = await gwCallFn(route, 'session.list', { title: gTitle, include_hidden: true }, pName);
          if (Array.isArray(gRes?.sessions)) {
            for (const gs of gRes.sessions) {
              const gsid = String(gs?.id || gs?.resolved_id || '').trim();
              if (gsid) discoveredGroupIds.push(gsid);
            }
          }
        } catch {}
      }

      const hiddenCandidates = Array.from(
        new Set(
          [
            canon?.id,
            canon?.resolved_id,
            ...discoveredGroupIds,
            ...missingLineageChildren,
          ]
            .filter((x) => typeof x === 'string' && x.trim())
            .map((x) => x.trim())
        )
      );

      for (const cid of hiddenCandidates) {
        if (existingIds.has(cid)) continue;
        const cacheKey = `${connScopeKey}:${pName}:${cid}`;
        const cachedEntry = botChatCache?.get?.(cacheKey);
        const isCanon = cid === canon?.id || cid === canon?.resolved_id;
        const canonStamp = isCanon ? toEpochMs(canon?.last_active ?? canon?.started_at) : null;
        if (
          !forceRefresh &&
          !activeIdSet.has(cid) &&
          cachedEntry &&
          cachedEntry.row &&
          (canonStamp == null || cachedEntry.canonStamp === canonStamp)
        ) {
          persisted.push(cachedEntry.row);
          existingIds.add(cid);
          continue;
        }

        let payload = null;
        for (const method of ['session.info', 'session.stats', 'session.usage']) {
          try {
            const r = await gwCallFn(route, method, { session_id: cid }, pName);
            if (r && typeof r === 'object') {
              const u = r.usage && typeof r.usage === 'object' ? r.usage : r;
              const hasAny =
                toNum(u.input ?? u.input_tokens ?? u.prompt ?? u.prompt_tokens) != null ||
                toNum(u.output ?? u.output_tokens) != null ||
                method === 'session.usage';
              if (hasAny) {
                payload = r;
                break;
              }
            }
          } catch {}
        }

        if (payload) {
          const synth = synthesizeCanonicalSessionRow(
            cid,
            pName,
            payload,
            isCanon ? canon : null,
            metaByProfile?.[pName]
          );
          if (synth) {
            if (childParentMap.has(cid)) {
              synth.parent_session_id = childParentMap.get(cid);
            }
            if (missingLineageChildren.includes(cid) && Array.from(childParentMap.values()).includes(cid)) {
              synth.end_reason = 'compression';
            }
            const guarded = keepHigherSessionWatermark(cachedEntry?.row, synth);
            persisted.push(guarded);
            existingIds.add(cid);
            if (botChatCache?.set) {
              botChatCache.set(cacheKey, { canonStamp, row: guarded });
            }
          }
        } else if (cachedEntry?.row) {
          persisted.push(cachedEntry.row);
          existingIds.add(cid);
        }
      }

      return persisted;
    })
  );

  return batches.flat();
}

function resolveToneLevel(usedRatio, triggerRatio) {
  if (usedRatio == null) return 'normal';
  const limit = triggerRatio || 0.85;
  const pressure = usedRatio / limit;
  if (pressure >= 0.92 || usedRatio >= 0.85) return 'danger';
  if (pressure >= 0.72 || usedRatio >= 0.65) return 'warn';
  return 'normal';
}

function buildScopeLabel(prefs, botName, profileCount, t) {
  const trMap = {
    today: { label: t.trToday, short: t.trTodayShort },
    '7d': { label: t.tr7d, short: t.tr7dShort },
    month: { label: t.trMonth, short: t.trMonthShort },
    all: { label: t.trAll, short: t.trAllShort },
  };
  const tr = trMap[prefs.timeRange] || trMap.today;
  if (prefs.usageScope === 'session') return { pill: t.scopeSession, chipPrefix: '' };
  if (prefs.usageScope === 'bot') return { pill: `${botName} / ${tr.label}`, chipPrefix: tr.short };
  return {
    pill: profileCount > 1 ? `${t.scopeAllCount(profileCount)} / ${tr.label}` : `${t.scopeAll} / ${tr.label}`,
    chipPrefix: `${t.scopeAll}·${tr.short}`,
  };
}

function SwitchRow({ checked, label, disabled, onToggle }) {
  return h(
    'div',
    {
      className: 'lub-toggle-row',
      role: 'switch',
      tabIndex: disabled ? -1 : 0,
      'aria-checked': String(Boolean(checked)),
      'aria-disabled': String(Boolean(disabled)),
      style: disabled ? { opacity: 0.45, pointerEvents: 'none' } : undefined,
      onClick: () => !disabled && onToggle(),
      onKeyDown: (e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onToggle();
        }
      },
    },
    h('span', { className: 'lub-toggle-title' }, label),
    h(
      'span',
      { className: 'lub-switch', 'data-checked': String(Boolean(checked)) },
      h('span', { className: 'lub-switch-thumb' })
    )
  );
}

function ConfigPanel({
  ctx,
  t,
  prefs,
  onPatch,
  onReset,
  onBack,
  onClose,
  botName,
  profileCount,
  initialTab,
  policy,
}) {
  const [tab, setTab] = React.useState(initialTab || 'policy');
  const [fxDraft, setFxDraft] = React.useState(() =>
    String(prefs.fxRates?.[prefs.currency] ?? CURRENCY_META[prefs.currency]?.defaultRate ?? 1)
  );

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setFxDraft(
      String(prefs.fxRates?.[prefs.currency] ?? CURRENCY_META[prefs.currency]?.defaultRate ?? 1)
    );
  }, [prefs.currency, prefs.fxRates]);

  const commitFx = () => {
    const n = Number(fxDraft);
    if (Number.isFinite(n) && n > 0) {
      onPatch({ fxRates: { ...prefs.fxRates, [prefs.currency]: n } });
    } else {
      const def = CURRENCY_META[prefs.currency]?.defaultRate ?? 1;
      setFxDraft(String(def));
      onPatch({ fxRates: { ...prefs.fxRates, [prefs.currency]: def } });
    }
  };

  const openHermesSettings = () => {
    try {
      if (typeof ctx?.runAction === 'function') {
        const res = ctx.runAction('nav.settings');
        if (!res || res.ok !== false) {
          if (typeof onClose === 'function') onClose();
          return;
        }
      }
    } catch {}
    try {
      if (typeof host?.navigate === 'function') {
        host.navigate('/settings');
        if (typeof onClose === 'function') onClose();
      }
    } catch {}
  };

  const tabs = [
    { id: 'policy', label: t.tabPolicy },
    { id: 'metrics', label: t.tabMetrics },
    { id: 'scope', label: t.tabScope },
    { id: 'style', label: t.tabStyle },
  ];

  const presetLabels = { minimal: t.presetMinimal, balanced: t.presetBalanced, full: t.presetFull };
  const timeRangeList = [
    { id: 'today', label: t.trToday },
    { id: '7d', label: t.tr7d },
    { id: 'month', label: t.trMonth },
    { id: 'all', label: t.trAll },
  ];

  let body = [];

  if (tab === 'policy') {
    const thresholdText =
      policy.threshold != null ? `${Math.round(policy.threshold * 100)}%` : t.defaultVal('50%');
    const targetText =
      policy.targetRatio != null ? `${Math.round(policy.targetRatio * 100)}%` : t.defaultVal('20%');
    const protectText =
      policy.protectLastN != null ? t.msgsUnit(policy.protectLastN) : t.defaultVal(t.msgsUnit(20));
    const memLimitText =
      policy.memoryCharLimit != null
        ? t.charsUnit(policy.memoryCharLimit)
        : t.defaultVal(t.charsUnit(2200));

    const policyRow = (key, label, value, muted = false) =>
      h(
        'div',
        { key, className: 'lub-policy-row' },
        h('span', { className: 'lub-policy-key' }, label),
        h('span', { className: 'lub-policy-val', 'data-muted': String(Boolean(muted)) }, value)
      );

    body = [
      h(
        'div',
        { key: 'comp-group', className: 'lub-cfg-group' },
        h(
          'div',
          { className: 'lub-cfg-label-row' },
          h('span', { className: 'lub-cfg-label' }, t.autoCompaction(botName)),
          h('span', { className: 'lub-readonly-pill' }, t.readOnlyBadge)
        ),
        h(
          'div',
          { className: 'lub-policy-list' },
          policyRow('en', t.enableAutoCompact, policy.enabled ? t.stateOn : t.stateOff, !policy.enabled),
          policy.enabled
            ? policyRow('th', t.triggerThreshold, thresholdText, policy.threshold == null)
            : null,
          policy.enabled
            ? policyRow('tr', t.targetRatio, targetText, policy.targetRatio == null)
            : null,
          policy.enabled
            ? policyRow('pr', t.protectRecent, protectText, policy.protectLastN == null)
            : null,
          policy.contextEngine ? policyRow('eng', t.contextEngine, policy.contextEngine) : null
        )
      ),
      h(
        'div',
        { key: 'mem-group', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.memoryBudget),
        h(
          'div',
          { className: 'lub-policy-list' },
          policyRow(
            'mem-en',
            t.persistentMemory,
            policy.memoryEnabled ? t.stateOn : t.stateOff,
            !policy.memoryEnabled
          ),
          policyRow(
            'usr-en',
            t.userProfile,
            policy.userProfileEnabled ? t.stateOn : t.stateOff,
            !policy.userProfileEnabled
          ),
          policy.memoryEnabled
            ? policyRow('mem-lim', t.memoryCharLimit, memLimitText, policy.memoryCharLimit == null)
            : null,
          policy.userProfileEnabled && policy.userCharLimit != null
            ? policyRow('usr-lim', t.userCharLimit, t.charsUnit(policy.userCharLimit))
            : null
        )
      ),
      h(
        'div',
        { key: 'cfg-foot', className: 'lub-policy-foot' },
        h('p', { className: 'lub-policy-note' }, t.policyReadOnlyHint),
        h(
          'button',
          { type: 'button', className: 'lub-settings-cta', onClick: openHermesSettings },
          t.openFullSettings
        )
      ),
    ];
  } else if (tab === 'metrics') {
    body = [
      h(
        'div',
        { key: 'presets', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.presets),
        h(
          'div',
          { className: 'lub-seg-row' },
          ...PRESETS.map((p) => {
            const active = Object.entries(p.patch).every(([k, v]) => prefs[k] === v);
            return h(
              'button',
              {
                key: p.id,
                type: 'button',
                className: 'lub-seg-btn',
                'data-active': String(active),
                onClick: () => onPatch(p.patch),
              },
              presetLabels[p.id]
            );
          })
        )
      ),
      h(
        'div',
        { key: 'toggles', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.barItems),
        h(
          'div',
          { className: 'lub-toggle-list' },
          h(SwitchRow, { checked: prefs.showBar, label: t.itemBar, onToggle: () => onPatch({ showBar: !prefs.showBar }) }),
          h(SwitchRow, { checked: prefs.showPct, label: t.itemPct, onToggle: () => onPatch({ showPct: !prefs.showPct }) }),
          h(SwitchRow, { checked: prefs.showRemain, label: t.itemRemain, onToggle: () => onPatch({ showRemain: !prefs.showRemain }) }),
          h(SwitchRow, { checked: prefs.showSpeed, label: t.itemSpeed, onToggle: () => onPatch({ showSpeed: !prefs.showSpeed }) }),
          h(SwitchRow, { checked: prefs.showTokens, label: t.itemTokens, onToggle: () => onPatch({ showTokens: !prefs.showTokens }) }),
          h(SwitchRow, { checked: prefs.showCache, label: t.itemCache, onToggle: () => onPatch({ showCache: !prefs.showCache }) }),
          h(SwitchRow, { checked: prefs.showCost, label: t.itemCost, onToggle: () => onPatch({ showCost: !prefs.showCost }) }),
          h(SwitchRow, { checked: prefs.showBot, label: t.itemBot, onToggle: () => onPatch({ showBot: !prefs.showBot }) }),
          h(SwitchRow, { checked: prefs.showModel, label: t.itemModel, onToggle: () => onPatch({ showModel: !prefs.showModel }) })
        )
      ),
    ];
  } else if (tab === 'scope') {
    const curMeta = CURRENCY_META[prefs.currency] || CURRENCY_META.USD;
    body = [
      h(
        'div',
        { key: 'scope', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.statProfiles),
        h(
          'div',
          { className: 'lub-seg-row' },
          ...[
            { id: 'session', label: t.optSession },
            { id: 'bot', label: botName },
            { id: 'all', label: profileCount > 1 ? t.scopeAllCount(profileCount) : t.optAllBots },
          ].map((opt) =>
            h(
              'button',
              {
                key: opt.id,
                type: 'button',
                className: 'lub-seg-btn',
                'data-active': String(prefs.usageScope === opt.id),
                onClick: () => onPatch({ usageScope: opt.id }),
              },
              opt.label
            )
          )
        ),
        h('span', { className: 'lub-cfg-label', style: { marginTop: '4px' } }, t.statTimeRange),
        h(
          'div',
          { className: 'lub-seg-row' },
          ...timeRangeList.map((tr) =>
            h(
              'button',
              {
                key: tr.id,
                type: 'button',
                className: 'lub-seg-btn',
                'data-active': String(prefs.usageScope !== 'session' && prefs.timeRange === tr.id),
                onClick: () =>
                  onPatch({
                    timeRange: tr.id,
                    ...(prefs.usageScope === 'session' ? { usageScope: 'bot' } : {}),
                  }),
              },
              tr.label
            )
          )
        ),
        h('span', { className: 'lub-cfg-label', style: { marginTop: '4px' } }, t.tokenFormat),
        h(
          'div',
          { className: 'lub-seg-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.tokenDisplay === 'io'),
              onClick: () => onPatch({ tokenDisplay: 'io' }),
            },
            t.fmtIO
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.tokenDisplay === 'total'),
              onClick: () => onPatch({ tokenDisplay: 'total' }),
            },
            t.fmtTotal
          )
        )
      ),
      h(
        'div',
        { key: 'currency', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.currency),
        h(
          'div',
          { className: 'lub-seg-row' },
          ...Object.values(CURRENCY_META).map((c) =>
            h(
              'button',
              {
                key: c.code,
                type: 'button',
                className: 'lub-seg-btn',
                style: { minWidth: '40px', padding: '5px 4px', fontSize: '10.5px' },
                'data-active': String(prefs.currency === c.code),
                onClick: () => onPatch({ currency: c.code }),
              },
              c.code === 'HKD' ? 'HK$' : `${c.symbol} ${c.code}`
            )
          )
        ),
        prefs.currency !== 'USD'
          ? h(
              'div',
              { className: 'lub-inline-field' },
              h('span', { className: 'lub-toggle-title' }, t.fxRate(curMeta.code)),
              h('input', {
                type: 'number',
                step: '0.01',
                min: '0.01',
                className: 'lub-num-input',
                value: fxDraft,
                'aria-label': t.fxRate(curMeta.code),
                onChange: (e) => setFxDraft(e.target.value),
                onBlur: commitFx,
                onKeyDown: (e) => {
                  if (e.key === 'Enter') commitFx();
                },
              })
            )
          : null,
        h(
          'div',
          { className: 'lub-inline-field' },
          h('span', { className: 'lub-toggle-title' }, t.precision),
          h(
            'div',
            { className: 'lub-seg-row', style: { width: '165px' } },
            ...[
              { id: 'auto', label: t.precAuto },
              { id: '2', label: t.prec2 },
              { id: '3', label: t.prec3 },
            ].map((p) =>
              h(
                'button',
                {
                  key: p.id,
                  type: 'button',
                  className: 'lub-seg-btn',
                  style: { minWidth: '44px', padding: '3px 4px' },
                  'data-active': String(prefs.costPrecision === p.id),
                  onClick: () => onPatch({ costPrecision: p.id }),
                },
                p.label
              )
            )
          )
        )
      ),
    ];
  } else {
    body = [
      h(
        'div',
        { key: 'lang', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.language),
        h(
          'div',
          { className: 'lub-seg-row' },
          ...[
            { id: 'auto', label: t.langAuto },
            { id: 'zh', label: '中文' },
            { id: 'en', label: 'English' },
          ].map((opt) =>
            h(
              'button',
              {
                key: opt.id,
                type: 'button',
                className: 'lub-seg-btn',
                'data-active': String(prefs.language === opt.id),
                onClick: () => onPatch({ language: opt.id }),
              },
              opt.label
            )
          )
        )
      ),
      h(
        'div',
        { key: 'skin', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.themeSkin),
        h(
          'div',
          { className: 'lub-seg-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.themeSkin === 'mono'),
              onClick: () => onPatch({ themeSkin: 'mono' }),
            },
            t.skinMono
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.themeSkin === 'prism'),
              onClick: () => onPatch({ themeSkin: 'prism' }),
            },
            t.skinPrism
          )
        ),
        prefs.themeSkin === 'prism'
          ? h(SwitchRow, {
              checked: prefs.barMotion,
              label: t.shimmerMotion,
              onToggle: () => onPatch({ barMotion: !prefs.barMotion }),
            })
          : null
      ),
      h(
        'div',
        { key: 'density', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.barDensity),
        h(
          'div',
          { className: 'lub-seg-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.barDensity === 'standard'),
              onClick: () => onPatch({ barDensity: 'standard' }),
            },
            t.densityStd
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'lub-seg-btn',
              'data-active': String(prefs.barDensity === 'compact'),
              onClick: () => onPatch({ barDensity: 'compact' }),
            },
            t.densityCompact
          )
        )
      ),
      h(
        'div',
        { key: 'breakdown', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.breakdownDetail),
        h(SwitchRow, {
          checked: prefs.showBreakdownBars,
          label: t.showCatBars,
          onToggle: () => onPatch({ showBreakdownBars: !prefs.showBreakdownBars }),
        }),
        prefs.showBreakdownBars
          ? h(
              'div',
              { className: 'lub-seg-row' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'lub-seg-btn',
                  'data-active': String(prefs.breakdownScale === 'used'),
                  onClick: () => onPatch({ breakdownScale: 'used' }),
                },
                t.scaleUsed
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'lub-seg-btn',
                  'data-active': String(prefs.breakdownScale === 'window'),
                  onClick: () => onPatch({ breakdownScale: 'window' }),
                },
                t.scaleWindow
              )
            )
          : null
      ),
    ];
  }

  return [
    h(
      'div',
      { key: 'cfg-head', className: 'lub-cfg-head' },
      h(
        'button',
        { type: 'button', className: 'lub-back-btn', onClick: onBack },
        h(IconChevronLeft),
        t.settings
      ),
      tab !== 'policy'
        ? h('button', { type: 'button', className: 'lub-text-btn', onClick: onReset }, t.reset)
        : null
    ),
    h(
      'div',
      { key: 'cfg-tabs', className: 'lub-tabs', role: 'tablist' },
      ...tabs.map((item) =>
        h(
          'button',
          {
            key: item.id,
            type: 'button',
            role: 'tab',
            'aria-selected': String(tab === item.id),
            className: 'lub-tab',
            'data-active': String(tab === item.id),
            onClick: () => setTab(item.id),
          },
          item.label
        )
      )
    ),
    h('div', { key: 'cfg-body', className: 'lub-cfg-body' }, ...body.filter(Boolean)),
  ];
}

function ContextBarChip({ ctx }) {
  const liveUsage = useValue(host.state.focusedUsage);
  const rawModel = useValue(host.state.model);
  const focusedSessionId = useValue(host.state.focusedSessionId);
  const activeSessionId = useValue(host.state.activeSessionId);
  const focusedStoredSessionId = useValue(host.state.focusedStoredSessionId);
  const focusedProfile = useValue(host.state.focusedSessionProfile);
  const activeProfile = useValue(host.state.profile);
  const focusedOwner = useValue(host.state.focusedSessionOwner);
  const stateConnId = useValue(host.state.connectionId);
  const busy = useValue(host.state.busy);

  // Only fall back to main-pane `activeSessionId` when neither `focusedSessionId` nor `focusedStoredSessionId` is set
  // (prevents a cold split-pane tile from borrowing the main pane's session ID across profiles!).
  const runtimeSid = focusedSessionId || (!focusedStoredSessionId ? activeSessionId : null);
  const candidateIds = [runtimeSid, focusedStoredSessionId].filter(
    (v, i, arr) => typeof v === 'string' && v.trim() && arr.indexOf(v) === i
  );
  const sessionId = candidateIds[0] || '';
  const profileSlug =
    String(focusedProfile || activeProfile || focusedOwner?.profile || 'default').trim() || 'default';
  const ownerConnId = String(focusedOwner?.connectionId || '').trim();
  const activeHostConnId =
    typeof host?.activeConnectionId === 'function' ? String(host.activeConnectionId() || '').trim() : '';
  const windowConnId = String(stateConnId || '').trim() || activeHostConnId;
  const effectiveConnId = ownerConnId || windowConnId;
  const connScopeKey = effectiveConnId || 'local';
  const isWindowPrimaryConn =
    !ownerConnId ||
    ownerConnId === windowConnId ||
    ((!windowConnId || windowConnId === 'local') && (ownerConnId === 'local' || isLocalRouteMode(focusedOwner)));

  const [prefs, setPrefs] = React.useState(() => loadPrefs(ctx));
  const lang = resolveLang(prefs.language, ctx);
  const t = I18N[lang] || I18N.en;

  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [view, setView] = React.useState('overview');
  const [configInitialTab, setConfigInitialTab] = React.useState('policy');

  const [rpcUsage, setRpcUsage] = React.useState(null);
  const [persistedSession, setPersistedSession] = React.useState(null);
  const [scopedSessions, setScopedSessions] = React.useState([]);
  const [scopeLoading, setScopeLoading] = React.useState(false);
  const [breakdown, setBreakdown] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const [policy, setPolicy] = React.useState({
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
  const [profileRouteHint, setProfileRouteHint] = React.useState(null);

  const [routeMapByConn, setRouteMapByConn] = React.useState({});
  const [botTitlesByConn, setBotTitlesByConn] = React.useState({});
  const [profileNamesByConn, setProfileNamesByConn] = React.useState({});
  const [canonicalByConn, setCanonicalByConn] = React.useState({});
  const [metaByConn, setMetaByConn] = React.useState({});
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [compactState, setCompactState] = React.useState('idle');
  const [compactMsg, setCompactMsg] = React.useState('');
  const [streamSpeed, setStreamSpeed] = React.useState({ tps: null, active: false });

  const routeMap = routeMapByConn[connScopeKey] || null;
  const botTitles = botTitlesByConn[connScopeKey] || {};
  const profileNames = profileNamesByConn[connScopeKey] || [];
  const canonicalByProfile = canonicalByConn[connScopeKey] || {};
  const metaByProfile = metaByConn[connScopeKey] || {};

  const closeTimerRef = React.useRef(null);
  const compactTimerRef = React.useRef(null);
  const policyReqRef = React.useRef(0);
  const prevBusyRef = React.useRef(Boolean(busy));
  const botChatCacheRef = React.useRef(new Map());
  const ledgerApiCacheRef = React.useRef(new Map());
  const ledgerRef = React.useRef(null);
  if (ledgerRef.current === null) {
    ledgerRef.current = loadUsageLedger(ctx);
  }
  const lastForceRefreshRef = React.useRef(0);
  const streamRef = React.useRef({
    active: false,
    firstTokenAt: 0,
    tokens: 0,
    lastEmitAt: 0,
    ema: null,
  });

  const updatePrefs = React.useCallback(
    (patch) => {
      setPrefs((prev) => {
        const next = sanitizePrefs({
          ...prev,
          ...patch,
          fxRates: patch.fxRates ? { ...prev.fxRates, ...patch.fxRates } : prev.fxRates,
        });
        savePrefs(ctx, next);
        return next;
      });
    },
    [ctx]
  );

  const resetPrefs = React.useCallback(() => {
    const def = sanitizePrefs(null);
    savePrefs(ctx, def);
    setPrefs(def);
  }, [ctx]);

  const cancelClose = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      globalThis.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      cancelClose();
      if (compactTimerRef.current !== null) {
        globalThis.clearTimeout(compactTimerRef.current);
        compactTimerRef.current = null;
      }
    },
    [cancelClose]
  );

  // 0. Resolve async SDK profileRoutes once per connection / refresh
  React.useEffect(() => {
    let cancelled = false;
    loadAsyncRouteMap(effectiveConnId).then((loaded) => {
      if (cancelled || !loaded || Object.keys(loaded).length === 0) return;
      setRouteMapByConn((prev) => ({
        ...prev,
        [connScopeKey]: { ...(prev[connScopeKey] || {}), ...loaded },
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [connScopeKey, effectiveConnId, refreshNonce]);

  // 1. Load full connection roster & canonical Bot Chat pointers (monotonically merged per connection
  // so switching into an isolated secondary bot never shrinks `profileNames` down to 1!)
  React.useEffect(() => {
    let cancelled = false;
    discoverConnectionRoster({ effectiveConnId, routeMap }).then((discovered) => {
      if (cancelled) return;
      if (discovered.routes && Object.keys(discovered.routes).length > 0) {
        setRouteMapByConn((prev) => {
          const cur = prev[connScopeKey] || {};
          const next = { ...cur, ...discovered.routes };
          const keys = Object.keys(next);
          if (
            keys.length === Object.keys(cur).length &&
            keys.every(
              (k) =>
                cur[k]?.connectionId === next[k]?.connectionId &&
                cur[k]?.mode === next[k]?.mode &&
                cur[k]?.profile === next[k]?.profile &&
                cur[k]?.targetProfile === next[k]?.targetProfile
            )
          ) {
            return prev;
          }
          return { ...prev, [connScopeKey]: next };
        });
      }
      if (Object.keys(discovered.titles).length > 0) {
        setBotTitlesByConn((prev) => ({
          ...prev,
          [connScopeKey]: { ...(prev[connScopeKey] || {}), ...discovered.titles },
        }));
      }
      if (Object.keys(discovered.canonicalByProfile).length > 0) {
        setCanonicalByConn((prev) => ({
          ...prev,
          [connScopeKey]: { ...(prev[connScopeKey] || {}), ...discovered.canonicalByProfile },
        }));
      }
      if (Object.keys(discovered.metaByProfile).length > 0) {
        setMetaByConn((prev) => ({
          ...prev,
          [connScopeKey]: { ...(prev[connScopeKey] || {}), ...discovered.metaByProfile },
        }));
      }
      setProfileNamesByConn((prev) => {
        const cur = prev[connScopeKey] || [];
        const mergedSet = new Set([...cur, ...discovered.names, profileSlug].filter(Boolean));
        const nextList = Array.from(mergedSet).sort();
        if (nextList.join(',') === cur.join(',')) return prev;
        return { ...prev, [connScopeKey]: nextList };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [connScopeKey, effectiveConnId, profileSlug, routeMap, refreshNonce]);

  // 2. Load official Hermes context/compression/memory config read-only via Plugin SDK (race-guarded on bot switch)
  const loadOfficialPolicy = React.useCallback(async () => {
    const reqId = ++policyReqRef.current;
    const route = resolveRoute({ connectionId: effectiveConnId, profile: profileSlug }, profileSlug, routeMap);
    const result = await readPolicyViaSdk(route, profileSlug, (r, m, p) => gwCall(r, m, p, profileSlug));
    if (reqId !== policyReqRef.current) return;
    setPolicy(result.policy);
    setProfileRouteHint({ ...result.routeHint, _profile: profileSlug });
  }, [effectiveConnId, profileSlug, routeMap]);

  React.useEffect(() => {
    loadOfficialPolicy();
  }, [effectiveConnId, profileSlug, loadOfficialPolicy, refreshNonce]);

  // 3. Fetch focused session context_breakdown + usage + persisted / canonical backfill
  const candidateIdsKey = candidateIds.join('|');
  React.useEffect(() => {
    const ids = candidateIdsKey ? candidateIdsKey.split('|') : [];
    if (ids.length === 0) {
      setRpcUsage(null);
      setPersistedSession(null);
      setBreakdown(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let retryTimer = null;
    const route = resolveRoute({ connectionId: effectiveConnId, profile: profileSlug }, profileSlug, routeMap);

    const fetchAll = async (attempt = 0) => {
      if (cancelled) return;
      if (attempt === 0) setLoading(true);
      let gotBreakdown = null;
      let gotUsage = null;

      const persistedPromise =
        attempt === 0 && typeof host.listPersistedSessions === 'function'
          ? host
              .listPersistedSessions(route, { profile: profileSlug, limit: 200 })
              .then((res) => {
                const list = Array.isArray(res?.sessions) ? res.sessions : [];
                const found =
                  list.find((s) => ids.includes(String(s?.id || ''))) ||
                  list.find((s) => ids.includes(String(s?.session_id || ''))) ||
                  null;
                // If `project_compression_tips` projected root counters onto a rotated tip ID, strip root counters
                // so single-session mode uses the live full-chain totals rather than a stale root-only cost!
                if (
                  found &&
                  Array.isArray(found._lineage_ids) &&
                  found._lineage_ids.length > 1 &&
                  found._lineage_root_id &&
                  found.id !== found._lineage_root_id
                ) {
                  return {
                    id: found.id,
                    model: found.model,
                    billing_provider: found.billing_provider,
                    billing_base_url: found.billing_base_url,
                    billing_mode: found.billing_mode,
                    cost_status: found.cost_status,
                    compression_count: found.compression_count,
                  };
                }
                return found;
              })
              .catch(() => null)
          : Promise.resolve(null);

      for (const sid of ids) {
        if (!gotBreakdown) {
          try {
            const bd = await gwCall(route, 'session.context_breakdown', { session_id: sid }, profileSlug);
            if (bd && (toNum(bd.context_max) > 0 || (Array.isArray(bd.categories) && bd.categories.length > 0))) {
              gotBreakdown = bd;
            }
          } catch {}
        }
        if (!gotUsage) {
          let u = null;
          for (const method of ['session.usage', 'session.stats', 'session.info']) {
            try {
              const raw = await gwCall(route, method, { session_id: sid }, profileSlug);
              const unwrapped = method === 'session.info' && raw?.usage ? raw.usage : raw;
              if (unwrapped && typeof unwrapped === 'object') {
                const hasData =
                  (toNum(unwrapped.total) ?? toNum(unwrapped.total_tokens) ?? 0) > 0 ||
                  (toNum(unwrapped.input) ?? toNum(unwrapped.input_tokens) ?? toNum(unwrapped.prompt) ?? 0) > 0 ||
                  (toNum(unwrapped.context_max) ?? 0) > 0 ||
                  (toNum(unwrapped.calls) ?? toNum(unwrapped.api_calls) ?? 0) > 0;
                if (hasData) {
                  u = unwrapped;
                  break;
                }
                if (!u && sid === ids[ids.length - 1]) {
                  u = unwrapped;
                }
              }
            } catch {}
          }
          if (u) gotUsage = u;
        }
        if (gotBreakdown && gotUsage) break;
      }

      let gotPersisted = await persistedPromise;
      const persistedHasTokens =
        gotPersisted &&
        ((toNum(gotPersisted.input_tokens) ?? 0) > 0 ||
          (toNum(gotPersisted.cache_read_tokens) ?? 0) > 0 ||
          (toNum(gotPersisted.output_tokens) ?? 0) > 0);
      // In standalone dashboard mode, hidden Bot Chats are excluded from `listPersistedSessions` and `session.usage`
      // returns 4001 on cold reload. Backfill the focused session directly from `/ledger` so Session scope shows immediately!
      if (!persistedHasTokens && isWindowPrimaryConn) {
        const cached = ledgerApiCacheRef.current.get(connScopeKey);
        let entries = cached && Date.now() - cached.fetchedAt < 2500 ? cached.entries : null;
        if (!entries) {
          const fresh = await fetchBackendLedger(ctx);
          if (fresh) {
            ledgerApiCacheRef.current.set(connScopeKey, { fetchedAt: Date.now(), entries: fresh.entries });
            entries = fresh.entries;
          }
        }
        if (entries) {
          const fromLedger = extractFocusedSessionFromLedger(entries, ids, profileSlug);
          if (fromLedger) {
            gotPersisted = fromLedger;
          }
        }
      }
      if (cancelled) return;
      if (gotBreakdown) setBreakdown({ ...gotBreakdown, _sid: sessionId });
      if (gotUsage) setRpcUsage({ ...gotUsage, _sid: sessionId });
      if (gotPersisted) setPersistedSession({ ...gotPersisted, _sid: sessionId });
      setLoading(false);

      if (!gotBreakdown && attempt < 2) {
        retryTimer = globalThis.setTimeout(() => fetchAll(attempt + 1), attempt === 0 ? 1500 : 3500);
      }
    };

    setBreakdown((prev) => (prev && prev._sid === sessionId ? prev : null));
    setRpcUsage((prev) => (prev && prev._sid === sessionId ? prev : null));
    setPersistedSession((prev) => (prev && prev._sid === sessionId ? prev : null));
    setCompactState('idle');
    setCompactMsg('');

    fetchAll(0);

    return () => {
      cancelled = true;
      if (retryTimer !== null) globalThis.clearTimeout(retryTimer);
    };
  }, [ctx, sessionId, candidateIdsKey, effectiveConnId, connScopeKey, isWindowPrimaryConn, profileSlug, routeMap, refreshNonce]);

  // 4. Fetch multi-session / multi-profile spend ledger:
  // Primary engine: authoritative read-only SQLite `/ledger` via official `ctx.rest('/ledger')`.
  // Automatic fallback: pure SDK `collectProfileSessionsForScope` when backend plugin API is absent/404.
  const profileNamesKey = profileNames.join(',');
  React.useEffect(() => {
    if (prefs.usageScope === 'session') {
      setScopedSessions([]);
      setScopeLoading(false);
      return;
    }

    let cancelled = false;
    setScopeLoading(true);
    const targetProfiles =
      prefs.usageScope === 'all'
        ? Array.from(new Set([...(profileNames.length > 0 ? profileNames : ['default']), profileSlug]))
        : [profileSlug];
    const forceRefresh = refreshNonce !== lastForceRefreshRef.current;
    lastForceRefreshRef.current = refreshNonce;
    const activeIds = candidateIdsKey ? candidateIdsKey.split('|') : [];

    const sliceEntriesForScope = (entries) =>
      prefs.usageScope === 'all'
        ? entries
        : entries.filter((e) => String(e?._profile || e?.profile || '') === profileSlug);

    (async () => {
      // `ctx.rest` is bound to the window's primary connection; only query `/ledger` when the focused pane belongs to it!
      const apiLedger = isWindowPrimaryConn ? await fetchBackendLedger(ctx) : null;
      if (cancelled) return;
      if (apiLedger) {
        ledgerApiCacheRef.current.set(connScopeKey, {
          fetchedAt: Date.now(),
          entries: apiLedger.entries,
        });
        if (Object.keys(apiLedger.titles).length > 0) {
          setBotTitlesByConn((prev) => ({
            ...prev,
            [connScopeKey]: { ...(prev[connScopeKey] || {}), ...apiLedger.titles },
          }));
        }
        if (Object.keys(apiLedger.metaByProfile).length > 0) {
          setMetaByConn((prev) => ({
            ...prev,
            [connScopeKey]: { ...(prev[connScopeKey] || {}), ...apiLedger.metaByProfile },
          }));
        }
        if (apiLedger.names.length > 0) {
          setProfileNamesByConn((prev) => {
            const cur = prev[connScopeKey] || [];
            const mergedSet = new Set([...cur, ...apiLedger.names, profileSlug].filter(Boolean));
            const nextList = Array.from(mergedSet).sort();
            if (nextList.join(',') === cur.join(',')) return prev;
            return { ...prev, [connScopeKey]: nextList };
          });
        }
        setScopedSessions(sliceEntriesForScope(apiLedger.entries));
        setScopeLoading(false);
        return;
      }

      // If a secondary profile had not enabled the dashboard API yet, reuse a fresh connection-wide `/ledger` snapshot if available
      const cachedApi = isWindowPrimaryConn ? ledgerApiCacheRef.current.get(connScopeKey) : null;
      if (cachedApi && Date.now() - cachedApi.fetchedAt < 60_000) {
        setScopedSessions(sliceEntriesForScope(cachedApi.entries));
        setScopeLoading(false);
        return;
      }

      const allRows = await collectProfileSessionsForScope({
        targetProfiles,
        connScopeKey,
        effectiveConnId,
        routeMap,
        canonicalByProfile,
        metaByProfile,
        botChatCache: botChatCacheRef.current,
        activeIds,
        forceRefresh,
      });
      if (cancelled) return;
      setScopedSessions(allRows);
      setScopeLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setScopeLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    ctx,
    isWindowPrimaryConn,
    prefs.usageScope,
    prefs.timeRange,
    connScopeKey,
    effectiveConnId,
    profileSlug,
    profileNamesKey,
    routeMap,
    canonicalByProfile,
    metaByProfile,
    candidateIdsKey,
    refreshNonce,
  ]);

  // 5. Refresh when a turn finishes
  React.useEffect(() => {
    const isBusy = Boolean(busy);
    if (prevBusyRef.current && !isBusy) {
      const tmr = globalThis.setTimeout(() => setRefreshNonce((n) => n + 1), 650);
      prevBusyRef.current = isBusy;
      return () => globalThis.clearTimeout(tmr);
    }
    prevBusyRef.current = isBusy;
  }, [busy]);

  // Reset measured streaming speed when switching sessions
  React.useEffect(() => {
    streamRef.current = { active: false, firstTokenAt: 0, tokens: 0, lastEmitAt: 0, ema: null };
    setStreamSpeed({ tps: null, active: false });
  }, [sessionId]);

  // 6. Subscribe to gateway usage, compression, and live streaming delta events for real-time tok/s
  React.useEffect(() => {
    if (typeof ctx?.onEvent !== 'function') return;
    const ids = candidateIdsKey ? candidateIdsKey.split('|') : [];
    const matchesSession = (ev) => {
      const sid = String(ev?.session_id || ev?.data?.session_id || '').trim();
      return !sid || ids.length === 0 || ids.includes(sid);
    };

    const onStreamStart = (ev) => {
      if (!matchesSession(ev)) return;
      streamRef.current = { active: true, firstTokenAt: 0, tokens: 0, lastEmitAt: 0, ema: null };
      setStreamSpeed((prev) => ({ tps: prev.tps, active: true }));
    };

    const onStreamDelta = (ev) => {
      if (!matchesSession(ev)) return;
      const chunk = ev?.text ?? ev?.data?.text ?? ev?.delta ?? '';
      const est = estimateChunkTokens(chunk);
      if (est <= 0) return;
      const now = Date.now();
      const st = streamRef.current;
      if (!st.active) {
        st.active = true;
        st.firstTokenAt = now;
        st.tokens = est;
        st.lastEmitAt = now;
        st.ema = null;
        return;
      }
      if (!st.firstTokenAt) st.firstTokenAt = now;
      st.tokens += est;
      const elapsedSec = (now - st.firstTokenAt) / 1000;
      if (elapsedSec >= 0.25 && now - st.lastEmitAt >= 180) {
        const rawRate = st.tokens / elapsedSec;
        const smoothed = st.ema == null ? rawRate : st.ema * 0.45 + rawRate * 0.55;
        st.ema = smoothed;
        st.lastEmitAt = now;
        setStreamSpeed({ tps: Math.round(smoothed * 10) / 10, active: true });
      }
    };

    const onStreamEnd = (ev) => {
      if (!matchesSession(ev)) return;
      const st = streamRef.current;
      let finalTps = st.ema;
      if (st.firstTokenAt > 0 && st.tokens > 0) {
        const elapsedSec = (Date.now() - st.firstTokenAt) / 1000;
        if (elapsedSec >= 0.15) finalTps = Math.round((st.tokens / elapsedSec) * 10) / 10;
      }
      st.active = false;
      setStreamSpeed((prev) => ({ tps: finalTps ?? prev.tps, active: false }));
    };

    const unsubs = [];
    const bind = (name, fn) => {
      try {
        const off = ctx.onEvent(name, fn);
        if (typeof off === 'function') unsubs.push(off);
      } catch {}
    };
    bind('message.start', onStreamStart);
    bind('message.delta', onStreamDelta);
    bind('reasoning.delta', onStreamDelta);
    bind('thinking.delta', onStreamDelta);
    bind('message.complete', onStreamEnd);
    bind('error', onStreamEnd);
    bind('session.usage', () => {
      streamRef.current.active = false;
      setStreamSpeed((prev) => ({ tps: prev.tps, active: false }));
      setRefreshNonce((n) => n + 1);
    });
    bind('session.compressed', () => setRefreshNonce((n) => n + 1));

    return () => {
      unsubs.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
  }, [ctx, candidateIdsKey]);

  const handleEnter = React.useCallback(() => {
    cancelClose();
    setOpen(true);
    if (!breakdown && sessionId) setRefreshNonce((n) => n + 1);
  }, [cancelClose, breakdown, sessionId]);

  const handleLeave = React.useCallback(() => {
    if (pinned || view === 'config') return;
    cancelClose();
    closeTimerRef.current = globalThis.setTimeout(() => setOpen(false), 200);
  }, [pinned, view, cancelClose]);

  const handleClick = React.useCallback(() => {
    cancelClose();
    setPinned((prev) => {
      const next = !prev;
      setOpen(next);
      if (next) {
        setView('overview');
        setRefreshNonce((n) => n + 1);
      }
      return next;
    });
  }, [cancelClose]);

  const openConfigTab = React.useCallback(
    (tabId) => {
      cancelClose();
      setConfigInitialTab(tabId || 'policy');
      setView('config');
      setPinned(true);
      setOpen(true);
    },
    [cancelClose]
  );

  const handleContextMenu = React.useCallback(
    (e) => {
      e.preventDefault();
      openConfigTab('metrics');
    },
    [openConfigTab]
  );

  const handleOpenChange = React.useCallback(
    (next) => {
      cancelClose();
      setOpen(next);
      if (!next) {
        setPinned(false);
        setView('overview');
        setCompactState('idle');
      }
    },
    [cancelClose]
  );

  const handleManualCompact = React.useCallback(async () => {
    if (!sessionId || busy) return;
    if (compactState !== 'confirm') {
      setCompactState('confirm');
      setCompactMsg('');
      return;
    }
    setCompactState('working');
    setCompactMsg(t.compacting);
    try {
      const route = resolveRoute({ connectionId: effectiveConnId, profile: profileSlug }, profileSlug, routeMap);
      const res = await gwCall(route, 'session.compress', { session_id: sessionId }, profileSlug);
      if (res?.status === 'aborted' || res?.compressed === false) {
        setCompactState('idle');
        setCompactMsg(t.compactSkipped);
      } else {
        setCompactState('done');
        setCompactMsg(res?.status === 'pending' ? t.compactQueued : t.compactDone);
        if (compactTimerRef.current !== null) globalThis.clearTimeout(compactTimerRef.current);
        compactTimerRef.current = globalThis.setTimeout(() => {
          compactTimerRef.current = null;
          setRefreshNonce((n) => n + 1);
        }, 800);
      }
    } catch (err) {
      setCompactState('error');
      setCompactMsg(err instanceof Error ? err.message : t.compactFailed);
    }
  }, [sessionId, busy, compactState, effectiveConnId, profileSlug, routeMap, t]);

  // ---- Derive Metrics (Strictly gate async state by `_sid` / `_profile` on first frame after bot switch!) ----
  const liveExplicitSid = String(liveUsage?.session_id || liveUsage?.sessionId || '').trim();
  const liveSidAligned = !liveExplicitSid || candidateIds.includes(liveExplicitSid);
  const alignedLiveUsage = liveSidAligned ? liveUsage : null;
  const alignedRpcUsage = sessionId && rpcUsage?._sid === sessionId ? rpcUsage : null;
  const alignedPersisted = sessionId && persistedSession?._sid === sessionId ? persistedSession : null;
  const alignedBreakdown = sessionId && breakdown?._sid === sessionId ? breakdown : null;
  const alignedProfileHint =
    profileRouteHint && profileRouteHint._profile === profileSlug ? profileRouteHint : null;

  const merged = mergeUsageSources(alignedLiveUsage, alignedRpcUsage, alignedPersisted, alignedBreakdown);
  const categories = normalizeCategories(alignedBreakdown, prefs.themeSkin, t);
  const modelName = resolveModelName(alignedLiveUsage, alignedRpcUsage, alignedPersisted, rawModel);
  const botName = botTitles[profileSlug] || profileSlug;
  const activeRouteHint =
    rawModel && typeof rawModel === 'object' ? rawModel : alignedProfileHint;
  const sessionCost = estimateSessionCost(
    merged,
    modelName,
    alignedLiveUsage,
    alignedRpcUsage,
    alignedPersisted,
    activeRouteHint
  );

  const isMultiSessionScope = prefs.usageScope !== 'session';
  const scopeLabel = buildScopeLabel(prefs, botName, profileNames.length, t);
  // While multi-profile sessions are loading for the very first time (`scopeLoading && scopedSessions.length === 0`),
  // suppress active-live-only fallback in `all` mode so switching bots never flashes single-bot spend!
  const allowActiveLiveFallback =
    prefs.usageScope !== 'all' || !scopeLoading || scopedSessions.length > 0;
  const scopedAgg = isMultiSessionScope
    ? aggregatePersistedSessions(
        scopedSessions,
        prefs.timeRange,
        candidateIds,
        merged,
        modelName,
        Date.now(),
        alignedLiveUsage,
        alignedRpcUsage,
        alignedPersisted,
        activeRouteHint,
        {
          __aggOpts: true,
          activeProfileSlug: profileSlug,
          connScopeKey,
          ledger: ledgerRef.current,
          mutateLedger: false,
          liveSidAligned: Boolean(sessionId) && liveSidAligned,
          includeActiveLive: allowActiveLiveFallback,
        }
      )
    : null;

  React.useEffect(() => {
    if (!scopedAgg?.observations?.length || !ledgerRef.current) return;
    let changed = false;
    for (const obs of scopedAgg.observations) {
      if (recordLedgerObservation(ledgerRef.current, obs.dayKey, obs.sessionKey, obs.snapshot)) {
        changed = true;
      }
    }
    if (changed) {
      saveUsageLedger(ctx, ledgerRef.current);
    }
  }, [ctx, scopedAgg]);

  const displayFreshInput = isMultiSessionScope ? scopedAgg.input : merged.input;
  const displayCacheRead = isMultiSessionScope ? scopedAgg.cacheRead : merged.cacheRead;
  const displayPromptTokens = isMultiSessionScope
    ? scopedAgg.promptTokens
    : (merged.promptTokens ?? merged.input);
  const displayOutput = isMultiSessionScope ? scopedAgg.output : merged.output;
  const displayTotal = isMultiSessionScope ? scopedAgg.total : merged.total;
  const displayCostAmount = isMultiSessionScope ? scopedAgg.costUsd : sessionCost.amount;
  const displayCostEstimated = isMultiSessionScope ? scopedAgg.estimated : sessionCost.estimated;

  const ctxMax = merged.ctxMax;
  const ctxUsed = merged.ctxUsed;
  const usedRatio =
    ctxMax && ctxMax > 0 && ctxUsed != null
      ? Math.min(1, ctxUsed / ctxMax)
      : merged.ctxPct != null
        ? merged.ctxPct / 100
        : null;
  const usedPctDisplay = usedRatio != null ? Math.round(usedRatio * 100) : null;

  const triggerRatio = policy.enabled ? (policy.threshold ?? 0.5) : null;
  const triggerTokens = ctxMax && triggerRatio != null ? Math.round(ctxMax * triggerRatio) : null;
  const remainingToTrigger =
    triggerTokens != null && ctxUsed != null ? Math.max(0, triggerTokens - ctxUsed) : null;
  const remainingWindow = ctxMax != null && ctxUsed != null ? Math.max(0, ctxMax - ctxUsed) : null;
  const bufferTokens =
    ctxMax != null && triggerTokens != null ? Math.max(0, ctxMax - triggerTokens) : null;

  const toneLevel = resolveToneLevel(usedRatio, triggerRatio);
  const fillWidthPct = usedRatio != null && usedRatio > 0 ? Math.min(100, Math.max(4, usedRatio * 100)) : 0;
  const showSheen = prefs.themeSkin === 'prism' && prefs.barMotion;

  // Live streaming tok/s while actively generating; exact gateway tokens_per_s once settled
  const effectiveTps = streamSpeed.active
    ? (streamSpeed.tps ?? merged.avgTps)
    : (merged.avgTps ?? streamSpeed.tps);
  const formattedTps = fmtTps(effectiveTps);

  // ---- Bottom Status Bar Segments (Every enabled switch renders visible output!) ----
  const segments = [];
  if (prefs.showBot) segments.push(h('span', { key: 'bot', className: 'lub-chip-primary' }, botName));
  if (prefs.showModel && modelName) segments.push(h('span', { key: 'model', className: 'lub-chip-tag' }, modelName));
  if (prefs.showBar) {
    segments.push(
      h(
        'span',
        { key: 'bar', className: 'lub-bar-track' },
        fillWidthPct > 0
          ? h(
              'span',
              {
                className: 'lub-bar-fill',
                'data-skin': prefs.themeSkin,
                'data-tone': toneLevel,
                style: { width: `${fillWidthPct}%` },
              },
              showSheen ? h('span', { className: 'lub-bar-sheen' }) : null
            )
          : null,
        triggerRatio != null
          ? h('span', {
              className: 'lub-bar-mark',
              style: { left: `${Math.min(96, Math.round(triggerRatio * 100))}%` },
            })
          : null
      )
    );
  }
  if (prefs.showPct) {
    segments.push(
      h(
        'span',
        { key: 'pct', className: 'lub-chip-primary', 'data-tone': toneLevel },
        usedPctDisplay != null ? `${usedPctDisplay}%` : loading ? '…' : '—'
      )
    );
  }
  if (prefs.showRemain) {
    segments.push(
      h(
        'span',
        {
          key: 'rem',
          className: 'lub-chip-muted',
          style: remainingToTrigger === 0 ? { color: '#dc2626', fontWeight: 600 } : undefined,
        },
        remainingToTrigger == null
          ? '—'
          : remainingToTrigger === 0
            ? t.atLimit
            : prefs.barDensity === 'compact'
              ? t.toCompactTiny(fmtCompact(remainingToTrigger))
              : t.toCompactShort(fmtCompact(remainingToTrigger))
      )
    );
  }
  // Live generation speed (tok/s) — streaming in real time, snapping to gateway avg_tps on settle
  if (prefs.showSpeed) {
    segments.push(
      h(
        'span',
        { key: 'speed', className: 'lub-speed' },
        h('span', { className: formattedTps ? 'lub-chip-primary' : 'lub-chip-muted' }, formattedTps ?? '—'),
        h('span', { className: 'lub-chip-unit' }, 'tok/s')
      )
    );
  }
  // Cache hit rate is a live session-level indicator — works regardless of spend scope!
  if (prefs.showCache) {
    segments.push(
      h(
        'span',
        { key: 'cache', className: 'lub-chip-muted' },
        t.cacheChip(merged.cacheHitPct != null ? `${merged.cacheHitPct}%` : '—')
      )
    );
  }

  const consumptionParts = [];
  if (prefs.showTokens) {
    const hasTok = (displayPromptTokens ?? 0) > 0 || (displayOutput ?? 0) > 0;
    consumptionParts.push(
      h(
        'span',
        { key: 'tok', className: 'lub-chip-muted' },
        !hasTok
          ? '—'
          : scopeLoading && scopedSessions.length === 0 && isMultiSessionScope
            ? '…'
            : prefs.tokenDisplay === 'total'
              ? fmtCompact(displayTotal ?? 0)
              : `↑${fmtCompact(displayPromptTokens ?? 0)} ↓${fmtCompact(displayOutput ?? 0)}`
      )
    );
  }
  if (prefs.showCost) {
    consumptionParts.push(
      h(
        'span',
        { key: 'cost', className: 'lub-chip-primary' },
        scopeLoading && scopedSessions.length === 0 && isMultiSessionScope
          ? '…'
          : displayCostAmount != null
            ? fmtCurrency(displayCostAmount, displayCostEstimated, prefs)
            : '—'
      )
    );
  }
  if (consumptionParts.length > 0) {
    if (segments.length > 0) segments.push(h('span', { key: 'div-cons', className: 'lub-divider' }));
    if (isMultiSessionScope && scopeLabel.chipPrefix) {
      segments.push(h('span', { key: 'scope-tag', className: 'lub-chip-tag' }, scopeLabel.chipPrefix));
    }
    segments.push(...consumptionParts);
  }
  if (segments.length === 0) segments.push(h('span', { key: 'fallback', className: 'lub-chip-muted' }, t.context));

  // ---- Overview Body ----
  const catTotal = categories.reduce((acc, c) => acc + c.tokens, 0);
  const kvRow = (key, label, value) =>
    h('div', { key, className: 'lub-kv' }, h('span', { className: 'lub-k' }, label), h('span', { className: 'lub-v' }, value));

  const occupiedRows = categories.map((c) => {
    const shareOfMax = ctxMax && ctxMax > 0 ? c.tokens / ctxMax : catTotal > 0 ? c.tokens / catTotal : 0;
    const shareOfUsed = catTotal > 0 ? c.tokens / catTotal : shareOfMax;
    const barPct =
      prefs.breakdownScale === 'window'
        ? Math.min(100, Math.max(3, shareOfMax * 100))
        : Math.min(100, Math.max(4, shareOfUsed * 100));
    return h(
      'li',
      { key: c.id, className: 'lub-cat-row', 'data-nobar': String(!prefs.showBreakdownBars) },
      h('span', { className: 'lub-dot', style: { background: c.color, opacity: c.opacity } }),
      h('span', { className: 'lub-cat-name', title: c.label }, c.label),
      prefs.showBreakdownBars
        ? h(
            'span',
            { className: 'lub-cat-bar-bg', title: t.barTooltip(fmtPct(shareOfUsed), fmtPct(shareOfMax)) },
            h('span', {
              className: 'lub-cat-bar-fg',
              style: { width: `${barPct}%`, background: c.color, opacity: c.opacity },
            })
          )
        : null,
      h('span', { className: 'lub-cat-tok' }, fmtCompact(c.tokens)),
      h('span', { className: 'lub-cat-pct' }, fmtPct(shareOfMax))
    );
  });

  const capacityRows = [];
  if (ctxMax && ctxMax > 0) {
    if (remainingToTrigger != null) {
      const freeRatio = remainingToTrigger / ctxMax;
      capacityRows.push(
        h(
          'li',
          { key: '__free', className: 'lub-cat-row', 'data-nobar': String(!prefs.showBreakdownBars) },
          h('span', { className: 'lub-dot-free' }),
          h('span', { className: 'lub-cat-name' }, t.available),
          prefs.showBreakdownBars
            ? h(
                'span',
                { className: 'lub-cat-bar-bg' },
                h('span', {
                  className: 'lub-cat-bar-fg',
                  style: { width: `${Math.min(100, freeRatio * 100)}%`, background: 'rgba(128, 128, 128, 0.28)' },
                })
              )
            : null,
          h('span', { className: 'lub-cat-tok' }, fmtCompact(remainingToTrigger)),
          h('span', { className: 'lub-cat-pct' }, fmtPct(freeRatio))
        )
      );
    }
    if (bufferTokens != null && bufferTokens > 0) {
      const bufRatio = bufferTokens / ctxMax;
      capacityRows.push(
        h(
          'li',
          { key: '__buffer', className: 'lub-cat-row', 'data-nobar': String(!prefs.showBreakdownBars) },
          h('span', { className: 'lub-dot-buf' }),
          h('span', { className: 'lub-cat-name' }, t.reserve),
          prefs.showBreakdownBars
            ? h(
                'span',
                { className: 'lub-cat-bar-bg' },
                h('span', {
                  className: 'lub-cat-bar-fg',
                  style: {
                    width: `${Math.min(100, bufRatio * 100)}%`,
                    background:
                      'repeating-linear-gradient(-45deg, rgba(128,128,128,0.34), rgba(128,128,128,0.34) 2.5px, transparent 2.5px, transparent 5px)',
                  },
                })
              )
            : null,
          h('span', { className: 'lub-cat-tok' }, fmtCompact(bufferTokens)),
          h('span', { className: 'lub-cat-pct' }, fmtPct(bufRatio))
        )
      );
    }
  }

  const costTooltip =
    prefs.currency !== 'USD'
      ? t.costTipFx(prefs.fxRates?.[prefs.currency] ?? CURRENCY_META[prefs.currency]?.defaultRate, prefs.currency)
      : t.costTipSwitch;

  const overviewBody = [
    h(
      'div',
      { key: 'head', className: 'lub-head' },
      h(
        'div',
        { className: 'lub-head-left' },
        h('span', { className: 'lub-bot' }, botName),
        modelName ? h('span', { className: 'lub-badge', title: modelName }, modelName) : null
      ),
      h(
        'div',
        { className: 'lub-head-actions' },
        h(
          'button',
          {
            type: 'button',
            className: 'lub-icon-btn',
            title: t.refresh,
            'aria-label': t.refresh,
            onClick: () => setRefreshNonce((n) => n + 1),
          },
          h(IconRefresh)
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'lub-icon-btn',
            title: t.settings,
            'aria-label': t.settings,
            onClick: () => openConfigTab('policy'),
          },
          h(IconSliders)
        )
      )
    ),

    // Section 1: Context Window
    h(
      'div',
      { key: 'ctx-sec', className: 'lub-section' },
      h(
        'div',
        { className: 'lub-title-row' },
        h('span', { className: 'lub-sec-title' }, t.context),
        h(
          'span',
          { className: 'lub-big-stat' },
          ctxMax && ctxUsed != null
            ? `${fmtCompact(ctxUsed)} / ${fmtCompact(ctxMax)} (${fmtPct(usedRatio)})`
            : usedPctDisplay != null
              ? `${usedPctDisplay}%`
              : loading
                ? '…'
                : '—'
        )
      ),
      h(
        'div',
        { className: 'lub-hero-track' },
        fillWidthPct > 0
          ? h(
              'span',
              {
                className: 'lub-hero-fill',
                'data-skin': prefs.themeSkin,
                'data-tone': toneLevel,
                style: { width: `${fillWidthPct}%` },
              },
              showSheen ? h('span', { className: 'lub-bar-sheen' }) : null
            )
          : null,
        triggerRatio != null && ctxMax
          ? h('span', {
              className: 'lub-hero-buffer',
              title: t.threshold(Math.round(triggerRatio * 100)),
              style: { width: `${Math.max(0, (1 - triggerRatio) * 100)}%` },
            })
          : null
      ),
      ctxMax && ctxUsed != null
        ? h(
            'div',
            { className: 'lub-runway-row' },
            h(
              'span',
              { className: 'lub-runway-main' },
              !policy.enabled
                ? t.leftWindow(fmtCompact(remainingWindow))
                : remainingToTrigger === 0
                  ? t.atLimit
                  : t.toCompact(fmtCompact(remainingToTrigger))
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'lub-inline-link',
                title: t.policyTip,
                onClick: () => openConfigTab('policy'),
              },
              !policy.enabled
                ? t.autoOff
                : merged.compressions != null && merged.compressions > 0
                  ? t.thresholdCompacted(Math.round(triggerRatio * 100), merged.compressions)
                  : t.threshold(Math.round(triggerRatio * 100))
            )
          )
        : null
    ),

    // Section 2: Breakdown
    h(
      'div',
      { key: 'cat-sec', className: 'lub-section' },
      h('div', { className: 'lub-title-row' }, h('span', { className: 'lub-sec-title' }, t.breakdown)),
      occupiedRows.length > 0 || capacityRows.length > 0
        ? h(
            'ul',
            { className: 'lub-cat-list' },
            ...occupiedRows,
            occupiedRows.length > 0 && capacityRows.length > 0
              ? h('li', { key: '__div', className: 'lub-cat-divider' })
              : null,
            ...capacityRows
          )
        : h('div', { className: 'lub-status-note' }, loading ? t.loading : t.noBreakdown)
    ),

    // Section 3: Spend
    h(
      'div',
      { key: 'tok-sec', className: 'lub-section' },
      h(
        'div',
        { className: 'lub-title-row' },
        h(
          'span',
          { className: 'lub-sec-title' },
          t.spend,
          h(
            'button',
            {
              type: 'button',
              className: 'lub-scope-btn',
              title: t.scopeTip,
              onClick: () => openConfigTab('scope'),
            },
            scopeLabel.pill,
            h(IconChevronDown)
          )
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'lub-big-stat',
            style: { border: 0, background: 'transparent', padding: 0, cursor: 'pointer' },
            title: costTooltip,
            onClick: () => openConfigTab('scope'),
          },
          scopeLoading
            ? '…'
            : displayCostAmount != null
              ? fmtCurrency(displayCostAmount, displayCostEstimated, prefs)
              : '—'
        )
      ),
      isMultiSessionScope
        ? h(
            'div',
            { className: 'lub-grid' },
            kvRow('in', t.input, fmtFull(displayFreshInput)),
            kvRow('cr', t.cachedInput, fmtFull(displayCacheRead)),
            kvRow('out', t.output, fmtFull(displayOutput)),
            kvRow('tot', t.total, fmtFull(displayTotal)),
            kvRow('cnt', t.sessions, t.sessionsUnit(scopedAgg.sessionCount))
          )
        : h(
            'div',
            { className: 'lub-grid' },
            kvRow('in', t.input, fmtFull(merged.input)),
            kvRow('cr', t.cachedInput, merged.cacheRead != null ? fmtFull(merged.cacheRead) : '—'),
            kvRow('out', t.output, fmtFull(merged.output)),
            kvRow('reason', t.reasoning, merged.reasoning != null ? fmtFull(merged.reasoning) : '—'),
            kvRow('tot', t.total, fmtFull(merged.total)),
            kvRow('cache', t.cache, merged.cacheHitPct != null ? `${merged.cacheHitPct}%` : '—'),
            kvRow('calls', t.calls, merged.calls != null ? t.callsUnit(merged.calls) : '—'),
            kvRow('speed', t.speed, formattedTps ? `${formattedTps} tok/s` : '—'),
            kvRow('lat', t.latency, merged.avgLatency != null ? `${merged.avgLatency}s` : '—')
          )
    ),

    // Footer Actions
    h(
      'div',
      { key: 'act', className: 'lub-actions' },
      h(
        'button',
        {
          type: 'button',
          className: `lub-btn${compactState === 'confirm' ? ' lub-btn-confirm' : ''}`,
          disabled: !sessionId || Boolean(busy) || compactState === 'working',
          onClick: handleManualCompact,
        },
        compactState === 'working'
          ? t.compacting
          : compactState === 'confirm'
            ? t.compactConfirm
            : t.compact
      ),
      compactMsg
        ? h('span', { className: 'lub-status-note', 'data-state': compactState === 'error' ? 'err' : 'ok' }, compactMsg)
        : null
    ),
  ];

  const cardChildren =
    view === 'config'
      ? [
          h(ConfigPanel, {
            key: 'cfg',
            ctx,
            t,
            prefs,
            onPatch: updatePrefs,
            onReset: resetPrefs,
            onBack: () => setView('overview'),
            onClose: () => {
              setPinned(false);
              setOpen(false);
            },
            botName,
            profileCount: profileNames.length,
            initialTab: configInitialTab,
            policy,
          }),
        ]
      : overviewBody;

  return h(
    Popover,
    { open, onOpenChange: handleOpenChange },
    h(
      PopoverTrigger,
      { asChild: true },
      h(
        'button',
        {
          type: 'button',
          className: 'lub-trigger',
          'data-density': prefs.barDensity,
          onMouseEnter: handleEnter,
          onMouseLeave: handleLeave,
          onClick: handleClick,
          onContextMenu: handleContextMenu,
          'aria-label': t.triggerAria,
        },
        ...segments
      )
    ),
    h(
      PopoverContent,
      {
        side: 'top',
        align: 'start',
        sideOffset: 6,
        className: 'lub-pop',
        onMouseEnter: handleEnter,
        onMouseLeave: handleLeave,
        onOpenAutoFocus: (e) => e.preventDefault(),
      },
      h('div', { className: 'lub-card', 'data-skin': prefs.themeSkin }, ...cardChildren)
    )
  );
}

export default {
  id: 'hermes-context-bar',
  name: 'Context Bar',
  description:
    'Always-on context runway, Claude Code /context-style breakdown, multi-bot & multi-currency spend tracking, one-click manual compaction, and read-only context & memory policy overview for Hermes Desktop.',
  defaultEnabled: true,
  register(ctx) {
    if (typeof document !== 'undefined') {
      const prev = document.getElementById(STYLE_ID);
      if (prev) prev.remove();
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLES;
      document.head.appendChild(style);
      ctx.onDispose(() => {
        style.remove();
      });
    }

    ctx.register({
      id: 'chip',
      area: STATUSBAR_AREAS.left,
      order: 40,
      render: () => h(ContextBarChip, { ctx }),
    });
  },
};
