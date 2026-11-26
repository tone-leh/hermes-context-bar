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
    syncTarget: (bot) => `同步写入 ${bot} 配置`,
    openFullSettings: '完整设置 ↗',
    saving: '保存中…',
    saved: '已保存',
    saveFailed: '保存失败',
    writeUnsupported: '当前环境不支持写入配置',
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
    policyTip: '修改自动压缩策略',
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
    enableAutoCompact: 'Enable auto-compact',
    triggerThreshold: 'Trigger threshold',
    targetRatio: 'Target summary ratio',
    protectRecent: 'Protect recent turns',
    contextEngine: 'Context engine',
    memoryBudget: 'Memory Budget',
    persistentMemory: 'Persistent memory',
    userProfile: 'User profile',
    memoryCharLimit: 'Memory char limit',
    syncTarget: (bot) => `Profile: ${bot}`,
    openFullSettings: 'Full Settings ↗',
    saving: 'Saving…',
    saved: 'Saved',
    saveFailed: 'Save failed',
    writeUnsupported: 'Config write unavailable here',
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
    policyTip: 'Configure auto-compaction',
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

const MODEL_PRICING = [
  [/gemini.*(flash-lite|hydrogen)/i, [0.15, 0.6, 0.0375]],
  [/gemini.*flash/i, [0.3, 2.5, 0.075]],
  [/gemini.*(pro|neon|ultra)/i, [1.25, 10.0, 0.3125]],
  [/claude.*opus/i, [15.0, 75.0, 1.5]],
  [/claude.*sonnet/i, [3.0, 15.0, 0.3]],
  [/claude.*haiku/i, [0.8, 4.0, 0.08]],
  [/gpt-4o-mini|o4-mini|o3-mini/i, [0.15, 0.6, 0.075]],
  [/gpt-4o|gpt-5|gpt-6|codex|astra|sol/i, [2.5, 10.0, 1.25]],
  [/\bo1\b|\bo3\b/i, [10.0, 40.0, 2.5]],
  [/deepseek.*(r1|reasoner)/i, [0.55, 2.19, 0.14]],
  [/deepseek/i, [0.27, 1.1, 0.07]],
  [/kimi|moonshot/i, [0.6, 2.5, 0.15]],
  [/glm/i, [0.5, 2.0, 0.1]],
  [/qwen/i, [0.4, 1.2, 0.1]],
];

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
.lub-stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lub-step-btn {
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.25));
  background: transparent;
  color: var(--foreground, inherit);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.lub-step-btn:hover:not(:disabled) { background: var(--chrome-action-hover, rgba(128, 128, 128, 0.10)); }
.lub-step-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.lub-step-val {
  min-width: 48px;
  text-align: center;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--foreground, inherit);
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
.lub-cfg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--ui-stroke-tertiary, rgba(128, 128, 128, 0.12));
  font-size: 11px;
  color: var(--ui-text-tertiary, #888);
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
      if (saved) return sanitizePrefs(saved);
      for (const oldKey of PREV_STORAGE_KEYS) {
        const prev = ctx.storage.get(oldKey, null);
        if (prev && typeof prev === 'object') return sanitizePrefs(prev);
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

// ---- Official Hermes Profile Config Helpers (/api/config & /api/config/schema) ----
function desktopApiAvailable() {
  return typeof globalThis.window !== 'undefined' && typeof globalThis.window.hermesDesktop?.api === 'function';
}

function buildApiScope(connectionId, profile) {
  const scope = { priority: 'foreground' };
  if (connectionId) scope.connectionId = connectionId;
  if (profile) scope.profile = profile;
  return scope;
}

async function readOfficialConfig(connectionId, profile) {
  if (!desktopApiAvailable()) return null;
  return globalThis.window.hermesDesktop.api({
    ...buildApiScope(connectionId, profile),
    path: '/api/config',
  });
}

async function readOfficialConfigSchema(connectionId, profile) {
  if (!desktopApiAvailable()) return null;
  return globalThis.window.hermesDesktop.api({
    ...buildApiScope(connectionId, profile),
    path: '/api/config/schema',
  });
}

async function writeOfficialConfigPatch(connectionId, profile, configPatch, fallbackErr) {
  if (!desktopApiAvailable()) throw new Error(fallbackErr);
  const res = await globalThis.window.hermesDesktop.api({
    ...buildApiScope(connectionId, profile),
    path: '/api/config',
    method: 'PUT',
    body: { config: configPatch },
  });
  if (res && res.ok === false) {
    throw new Error(res.error || res.detail || fallbackErr);
  }
  return res;
}

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

function readSchemaChoices(schema, key) {
  const f = schema?.fields?.[key];
  if (!f || typeof f !== 'object') return [];
  const raw = f.enum || f.choices || f.options;
  return Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
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

function estimateRawTokensUsd(input, output, modelName, cacheRead = null, cacheHitPct = null, reasoning = 0, total = null) {
  const i = input ?? 0;
  const o = output ?? 0;
  if (i === 0 && o === 0) return null;
  if (!modelName) return null;
  const matched = MODEL_PRICING.find(([re]) => re.test(modelName));
  if (!matched) return null;
  const [inRate, outRate, cacheRate] = matched[1];
  const cachedIn =
    cacheRead != null
      ? Math.min(i, cacheRead)
      : cacheHitPct != null && cacheHitPct > 0
        ? i * Math.min(1, cacheHitPct / 100)
        : 0;
  const freshIn = Math.max(0, i - cachedIn);
  const r = reasoning ?? 0;
  const reasoningExtra = r > 0 && total != null && total >= i + o + r ? r : 0;
  return (freshIn * inRate + cachedIn * cacheRate + (o + reasoningExtra) * outRate) / 1e6;
}

function mergeUsageSources(liveUsage, rpcUsage, persistedSession, breakdown) {
  const a = liveUsage && typeof liveUsage === 'object' ? liveUsage : {};
  const b = rpcUsage && typeof rpcUsage === 'object' ? rpcUsage : {};
  const ps = persistedSession && typeof persistedSession === 'object' ? persistedSession : {};
  const bd = breakdown && typeof breakdown === 'object' ? breakdown : {};

  const input = pickBestNum(
    a.input, a.input_tokens, a.prompt_tokens,
    b.input, b.input_tokens, b.prompt_tokens,
    ps.input_tokens, ps.prompt_tokens
  );
  const output = pickBestNum(
    a.output, a.output_tokens, a.completion_tokens,
    b.output, b.output_tokens, b.completion_tokens,
    ps.output_tokens, ps.completion_tokens
  );
  const reasoning = pickBestNum(a.reasoning, a.reasoning_tokens, b.reasoning, b.reasoning_tokens, ps.reasoning_tokens);
  const total =
    pickBestNum(a.total, a.total_tokens, b.total, b.total_tokens, ps.total_tokens) ??
    (input != null || output != null ? (input || 0) + (output || 0) : null);
  const calls = pickBestNum(a.calls, a.api_calls, b.calls, b.api_calls, ps.api_calls);

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

  // Support both snake_case and camelCase cache fields from gateway & provider usage
  const cacheRead = pickBestNum(
    a.cache_read_tokens, a.cache_read, a.cacheRead, a.cacheReadTokens, a.cache_read_input_tokens, a.cached_tokens, a.cached_input_tokens,
    b.cache_read_tokens, b.cache_read, b.cacheRead, b.cacheReadTokens, b.cache_read_input_tokens, b.cached_tokens, b.cached_input_tokens,
    ps.cache_read_tokens, ps.cache_read, ps.cached_tokens
  );
  const promptBase = pickBestNum(a.prompt, a.prompt_tokens, b.prompt, b.prompt_tokens, ps.input_tokens, input);
  const directCachePct = pickBestNum(a.cache_hit_pct, a.cacheHitPct, b.cache_hit_pct, b.cacheHitPct);
  const derivedCachePct =
    cacheRead != null && cacheRead > 0 && promptBase && promptBase > 0
      ? Math.max(0, Math.min(100, Math.round((cacheRead / promptBase) * 100)))
      : null;
  const cacheHitPct =
    directCachePct != null && directCachePct > 0
      ? directCachePct
      : derivedCachePct ?? directCachePct;

  const compressions = pickBestNum(a.compressions, b.compressions, b.compression_count, bd.compressions, ps.compression_count);
  const avgTps = pickBestNum(a.avg_tps, a.tokens_per_s, b.avg_tps, b.tokens_per_s);
  const avgLatency = pickBestNum(a.avg_latency_s, b.avg_latency_s);
  const backendCost = pickBestNum(
    a.actual_cost_usd, a.cost_usd, a.estimated_cost_usd,
    b.actual_cost_usd, b.cost_usd, b.estimated_cost_usd,
    ps.actual_cost_usd, ps.cost_usd, ps.estimated_cost_usd
  );

  return {
    input, output, reasoning, total, calls,
    ctxUsed, ctxMax, ctxPct,
    cacheRead, cacheHitPct, compressions,
    avgTps, avgLatency, backendCost,
  };
}

function estimateSessionCost(merged, modelName) {
  if (merged.backendCost != null) return { amount: merged.backendCost, estimated: false };
  const usd = estimateRawTokensUsd(
    merged.input, merged.output, modelName,
    merged.cacheRead, merged.cacheHitPct, merged.reasoning, merged.total
  );
  if (usd == null) return { amount: null, estimated: true };
  return { amount: usd, estimated: true };
}

function aggregatePersistedSessions(sessions, timeRange, activeCandidateIds, liveMerged, liveModelName, nowMs = Date.now()) {
  const cutoffMs = getTimeRangeCutoffMs(timeRange, nowMs);
  const activeSet = new Set((activeCandidateIds || []).filter(Boolean));
  const byId = new Map();
  for (const s of sessions) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id || s.session_id || '');
    if (!id) continue;
    const ts = toEpochMs(s.last_active) ?? toEpochMs(s.started_at);
    if (cutoffMs > 0 && (ts == null || ts < cutoffMs)) continue;
    if (!byId.has(id)) byId.set(id, s);
  }

  let input = 0;
  let output = 0;
  let costUsd = 0;
  let hasAnyCost = false;
  let anyEstimated = false;
  let matchedActive = false;

  for (const [id, s] of byId.entries()) {
    let sIn = toNum(s.input_tokens) ?? 0;
    let sOut = toNum(s.output_tokens) ?? 0;
    let sCost = pickBestNum(s.actual_cost_usd, s.cost_usd, s.estimated_cost_usd);
    let sEst = false;

    if (activeSet.has(id) && liveMerged) {
      matchedActive = true;
      sIn = Math.max(sIn, liveMerged.input ?? 0);
      sOut = Math.max(sOut, liveMerged.output ?? 0);
      if (liveMerged.backendCost != null) sCost = Math.max(sCost ?? 0, liveMerged.backendCost);
    }

    if (sCost == null && (sIn > 0 || sOut > 0)) {
      const est = estimateRawTokensUsd(sIn, sOut, s.model || liveModelName);
      if (est != null) {
        sCost = est;
        sEst = true;
      }
    }

    input += sIn;
    output += sOut;
    if (sCost != null) {
      costUsd += sCost;
      hasAnyCost = true;
      if (sEst) anyEstimated = true;
    }
  }

  const primaryActiveId = activeCandidateIds?.[0] || '';
  if (
    primaryActiveId &&
    !matchedActive &&
    liveMerged &&
    ((liveMerged.input ?? 0) > 0 || (liveMerged.output ?? 0) > 0 || (liveMerged.backendCost ?? 0) > 0)
  ) {
    byId.set(primaryActiveId, { id: primaryActiveId });
    input += liveMerged.input ?? 0;
    output += liveMerged.output ?? 0;
    const liveCost = estimateSessionCost(liveMerged, liveModelName);
    if (liveCost.amount != null) {
      costUsd += liveCost.amount;
      hasAnyCost = true;
      if (liveCost.estimated) anyEstimated = true;
    }
  }

  return {
    input,
    output,
    total: input + output,
    sessionCount: byId.size,
    costUsd: hasAnyCost ? costUsd : null,
    estimated: anyEstimated,
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

function resolveRoute(owner, profileSlug) {
  const connId = String(owner?.connectionId || '').trim();
  const profile = String(owner?.profile || profileSlug || 'default').trim() || 'default';
  if (!connId) return null;
  return {
    connectionId: connId,
    mode: connId === 'local' ? 'local' : 'remote',
    profile,
    targetProfile: profile,
  };
}

async function gwCall(route, method, params = {}) {
  if (route && typeof host.requestProfile === 'function') {
    try {
      return await host.requestProfile(route, method, params);
    } catch {}
  }
  if (typeof host.request === 'function') {
    return host.request(method, params);
  }
  throw new Error('Hermes gateway unavailable');
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
  botName,
  profileCount,
  initialTab,
  policy,
  policySchema,
  policyBusy,
  policyNote,
  onSavePolicy,
}) {
  const [tab, setTab] = React.useState(initialTab || 'policy');
  const [fxDraft, setFxDraft] = React.useState(() =>
    String(prefs.fxRates?.[prefs.currency] ?? CURRENCY_META[prefs.currency]?.defaultRate ?? 1)
  );
  const [memLimitDraft, setMemLimitDraft] = React.useState(() =>
    policy.memoryCharLimit != null ? String(policy.memoryCharLimit) : '2200'
  );

  React.useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    setFxDraft(
      String(prefs.fxRates?.[prefs.currency] ?? CURRENCY_META[prefs.currency]?.defaultRate ?? 1)
    );
  }, [prefs.currency, prefs.fxRates]);

  React.useEffect(() => {
    if (policy.memoryCharLimit != null) setMemLimitDraft(String(policy.memoryCharLimit));
  }, [policy.memoryCharLimit]);

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

  const commitMemLimit = () => {
    const n = Math.round(Number(memLimitDraft));
    if (Number.isFinite(n) && n >= 200 && n <= 50000) {
      if (n !== policy.memoryCharLimit) onSavePolicy({ memory: { memory_char_limit: n } });
    } else if (policy.memoryCharLimit != null) {
      setMemLimitDraft(String(policy.memoryCharLimit));
    }
  };

  const saveThreshold = (nextPct) => {
    const clamped = Math.min(95, Math.max(25, nextPct));
    const nextRatio = Number((clamped / 100).toFixed(2));
    const compPatch = { threshold: nextRatio };
    // Ensure target_ratio remains strictly below threshold
    if (policy.targetRatio != null && policy.targetRatio >= nextRatio) {
      compPatch.target_ratio = Number(Math.max(0.1, nextRatio - 0.1).toFixed(2));
    }
    onSavePolicy({ compression: compPatch });
  };

  const openHermesSettings = () => {
    try {
      if (typeof ctx?.runAction === 'function') {
        ctx.runAction('nav.settings');
        return;
      }
    } catch {}
    try {
      if (typeof globalThis.window !== 'undefined') globalThis.window.location.hash = '#/settings';
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
    const curThresholdPct = Math.round((policy.threshold ?? 0.5) * 100);
    const curTargetPct = Math.round((policy.targetRatio ?? 0.2) * 100);
    const curProtect = policy.protectLastN ?? 6;
    const engineChoices = readSchemaChoices(policySchema, 'context.engine');
    const canWrite = desktopApiAvailable();

    body = [
      h(
        'div',
        { key: 'comp-group', className: 'lub-cfg-group' },
        h(
          'div',
          { className: 'lub-cfg-label-row' },
          h('span', { className: 'lub-cfg-label' }, t.autoCompaction(botName)),
          policyNote
            ? h('span', { className: 'lub-status-note', 'data-state': policyNote.err ? 'err' : 'ok' }, policyNote.text)
            : null
        ),
        h(SwitchRow, {
          checked: policy.enabled,
          label: t.enableAutoCompact,
          disabled: !canWrite || policyBusy,
          onToggle: () => onSavePolicy({ compression: { enabled: !policy.enabled } }),
        }),
        policy.enabled
          ? h(
              'div',
              { className: 'lub-inline-field' },
              h('span', { className: 'lub-toggle-title' }, t.triggerThreshold),
              h(
                'div',
                { className: 'lub-stepper' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lub-step-btn',
                    disabled: !canWrite || policyBusy || curThresholdPct <= 25,
                    onClick: () => saveThreshold(curThresholdPct - 5),
                  },
                  '−'
                ),
                h('span', { className: 'lub-step-val' }, `${curThresholdPct}%`),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lub-step-btn',
                    disabled: !canWrite || policyBusy || curThresholdPct >= 95,
                    onClick: () => saveThreshold(curThresholdPct + 5),
                  },
                  '+'
                )
              )
            )
          : null,
        policy.enabled
          ? h(
              'div',
              { className: 'lub-seg-row' },
              ...[50, 65, 75, 85].map((pct) =>
                h(
                  'button',
                  {
                    key: pct,
                    type: 'button',
                    className: 'lub-seg-btn',
                    disabled: !canWrite || policyBusy,
                    'data-active': String(curThresholdPct === pct),
                    onClick: () => saveThreshold(pct),
                  },
                  `${pct}%`
                )
              )
            )
          : null,
        policy.enabled
          ? h(
              'div',
              { className: 'lub-inline-field' },
              h('span', { className: 'lub-toggle-title' }, t.targetRatio),
              h(
                'div',
                { className: 'lub-seg-row', style: { width: '150px' } },
                ...[20, 30, 40].map((pct) =>
                  h(
                    'button',
                    {
                      key: pct,
                      type: 'button',
                      className: 'lub-seg-btn',
                      style: { minWidth: '42px', padding: '3px 4px' },
                      disabled: !canWrite || policyBusy || pct >= curThresholdPct,
                      'data-active': String(curTargetPct === pct),
                      onClick: () => onSavePolicy({ compression: { target_ratio: pct / 100 } }),
                    },
                    `${pct}%`
                  )
                )
              )
            )
          : null,
        policy.enabled
          ? h(
              'div',
              { className: 'lub-inline-field' },
              h('span', { className: 'lub-toggle-title' }, t.protectRecent),
              h(
                'div',
                { className: 'lub-stepper' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lub-step-btn',
                    disabled: !canWrite || policyBusy || curProtect <= 2,
                    onClick: () => onSavePolicy({ compression: { protect_last_n: Math.max(2, curProtect - 2) } }),
                  },
                  '−'
                ),
                h('span', { className: 'lub-step-val' }, t.msgsUnit(curProtect)),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'lub-step-btn',
                    disabled: !canWrite || policyBusy || curProtect >= 30,
                    onClick: () => onSavePolicy({ compression: { protect_last_n: Math.min(30, curProtect + 2) } }),
                  },
                  '+'
                )
              )
            )
          : null,
        engineChoices.length > 0
          ? h(
              'div',
              { className: 'lub-cfg-group', style: { borderTop: 0, paddingTop: 2 } },
              h('span', { className: 'lub-cfg-label' }, t.contextEngine),
              h(
                'div',
                { className: 'lub-seg-row' },
                ...engineChoices.map((eng) =>
                  h(
                    'button',
                    {
                      key: eng,
                      type: 'button',
                      className: 'lub-seg-btn',
                      disabled: !canWrite || policyBusy,
                      'data-active': String(policy.contextEngine === eng),
                      onClick: () => onSavePolicy({ context: { engine: eng } }),
                    },
                    eng
                  )
                )
              )
            )
          : null
      ),
      h(
        'div',
        { key: 'mem-group', className: 'lub-cfg-group' },
        h('span', { className: 'lub-cfg-label' }, t.memoryBudget),
        h(SwitchRow, {
          checked: policy.memoryEnabled,
          label: t.persistentMemory,
          disabled: !canWrite || policyBusy,
          onToggle: () => onSavePolicy({ memory: { memory_enabled: !policy.memoryEnabled } }),
        }),
        h(SwitchRow, {
          checked: policy.userProfileEnabled,
          label: t.userProfile,
          disabled: !canWrite || policyBusy,
          onToggle: () => onSavePolicy({ memory: { user_profile_enabled: !policy.userProfileEnabled } }),
        }),
        policy.memoryEnabled
          ? h(
              'div',
              { className: 'lub-inline-field' },
              h('span', { className: 'lub-toggle-title' }, t.memoryCharLimit),
              h('input', {
                type: 'number',
                step: '200',
                min: '200',
                max: '50000',
                disabled: !canWrite || policyBusy,
                className: 'lub-num-input',
                value: memLimitDraft,
                'aria-label': t.memoryCharLimit,
                onChange: (e) => setMemLimitDraft(e.target.value),
                onBlur: commitMemLimit,
                onKeyDown: (e) => {
                  if (e.key === 'Enter') commitMemLimit();
                },
              })
            )
          : null
      ),
      h(
        'div',
        { key: 'cfg-foot', className: 'lub-cfg-foot' },
        h('span', null, t.syncTarget(botName)),
        h('button', { type: 'button', className: 'lub-text-btn', onClick: openHermesSettings }, t.openFullSettings)
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
  const busy = useValue(host.state.busy);

  const candidateIds = [focusedSessionId, activeSessionId, focusedStoredSessionId].filter(
    (v, i, arr) => typeof v === 'string' && v.trim() && arr.indexOf(v) === i
  );
  const sessionId = candidateIds[0] || '';
  const profileSlug =
    String(focusedProfile || activeProfile || focusedOwner?.profile || 'default').trim() || 'default';
  const ownerConnId = String(focusedOwner?.connectionId || '').trim();

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
  const [policySchema, setPolicySchema] = React.useState(null);
  const [policyBusy, setPolicyBusy] = React.useState(false);
  const [policyNote, setPolicyNote] = React.useState(null);

  const [botTitles, setBotTitles] = React.useState({});
  const [profileNames, setProfileNames] = React.useState([]);
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [compactState, setCompactState] = React.useState('idle');
  const [compactMsg, setCompactMsg] = React.useState('');
  const [streamSpeed, setStreamSpeed] = React.useState({ tps: null, active: false });

  const closeTimerRef = React.useRef(null);
  const noteTimerRef = React.useRef(null);
  const policyReqRef = React.useRef(0);
  const prevBusyRef = React.useRef(Boolean(busy));
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
      if (noteTimerRef.current !== null) globalThis.clearTimeout(noteTimerRef.current);
    },
    [cancelClose]
  );

  // 1. Load bot profiles & display names
  React.useEffect(() => {
    let cancelled = false;
    const route = resolveRoute({ connectionId: ownerConnId, profile: profileSlug }, profileSlug);
    gwCall(route, 'profiles.list', { include_sessions: false })
      .then((res) => {
        if (cancelled || !Array.isArray(res?.profiles)) return;
        const nextTitles = {};
        const names = [];
        for (const p of res.profiles) {
          const name = String(p?.name || '').trim();
          if (!name) continue;
          names.push(name);
          const title = String(p?.ui_meta?.['hermes-bots']?.title || p?.display_name || '').trim();
          if (title) nextTitles[name] = title;
        }
        if (Object.keys(nextTitles).length > 0) setBotTitles((prev) => ({ ...prev, ...nextTitles }));
        if (names.length > 0) {
          setProfileNames((prev) => (prev.join(',') === names.join(',') ? prev : names));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ownerConnId, profileSlug]);

  // 2. Load official Hermes context/compression/memory config + schema (race-guarded on bot switch)
  const loadOfficialPolicy = React.useCallback(async () => {
    const reqId = ++policyReqRef.current;
    const route = resolveRoute({ connectionId: ownerConnId, profile: profileSlug }, profileSlug);
    try {
      const cfg = await readOfficialConfig(ownerConnId, profileSlug);
      if (reqId !== policyReqRef.current) return;
      if (cfg && typeof cfg === 'object') {
        setPolicy(extractContextPolicy(cfg));
        return;
      }
    } catch {}
    const [enRes, thRes, secRes] = await Promise.all([
      gwCall(route, 'config.get', { key: 'compression.enabled' }).catch(() => null),
      gwCall(route, 'config.get', { key: 'compression.threshold' }).catch(() => null),
      gwCall(route, 'config.get', { key: 'compression' }).catch(() => null),
    ]);
    if (reqId !== policyReqRef.current) return;
    const sec = secRes?.value && typeof secRes.value === 'object' ? secRes.value : secRes;
    const enabledRaw = enRes?.value !== undefined ? enRes.value : sec?.enabled !== undefined ? sec.enabled : true;
    const thresholdRaw = thRes?.value !== undefined ? thRes.value : sec?.threshold ?? null;
    setPolicy((prev) => ({
      ...prev,
      enabled: enabledRaw !== false,
      threshold: normalizeThreshold(thresholdRaw),
    }));
  }, [ownerConnId, profileSlug]);

  React.useEffect(() => {
    let cancelled = false;
    setPolicyNote(null);
    loadOfficialPolicy();
    readOfficialConfigSchema(ownerConnId, profileSlug)
      .then((schema) => {
        if (!cancelled && schema && typeof schema === 'object') setPolicySchema(schema);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ownerConnId, profileSlug, loadOfficialPolicy, refreshNonce]);

  const handleSavePolicy = React.useCallback(
    async (configPatch) => {
      setPolicyBusy(true);
      setPolicyNote({ text: t.saving, err: false });
      try {
        await writeOfficialConfigPatch(ownerConnId, profileSlug, configPatch, t.writeUnsupported);
        await loadOfficialPolicy();
        setPolicyNote({ text: t.saved, err: false });
        if (noteTimerRef.current !== null) globalThis.clearTimeout(noteTimerRef.current);
        noteTimerRef.current = globalThis.setTimeout(() => setPolicyNote(null), 1800);
      } catch (err) {
        setPolicyNote({ text: err instanceof Error ? err.message : t.saveFailed, err: true });
      } finally {
        setPolicyBusy(false);
      }
    },
    [ownerConnId, profileSlug, loadOfficialPolicy, t]
  );

  // 3. Fetch focused session context_breakdown + usage + persisted backfill
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
    const route = resolveRoute({ connectionId: ownerConnId, profile: profileSlug }, profileSlug);

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
                return (
                  list.find((s) => ids.includes(String(s?.id || ''))) ||
                  list.find((s) => ids.includes(String(s?.session_id || ''))) ||
                  null
                );
              })
              .catch(() => null)
          : Promise.resolve(null);

      for (const sid of ids) {
        if (!gotBreakdown) {
          try {
            const bd = await gwCall(route, 'session.context_breakdown', { session_id: sid });
            if (bd && (toNum(bd.context_max) > 0 || (Array.isArray(bd.categories) && bd.categories.length > 0))) {
              gotBreakdown = bd;
            }
          } catch {}
        }
        if (!gotUsage) {
          try {
            const u = await gwCall(route, 'session.usage', { session_id: sid });
            if (u && typeof u === 'object') {
              const hasData =
                (toNum(u.total) ?? toNum(u.total_tokens) ?? 0) > 0 ||
                (toNum(u.input) ?? toNum(u.input_tokens) ?? 0) > 0 ||
                (toNum(u.context_max) ?? 0) > 0 ||
                (toNum(u.calls) ?? toNum(u.api_calls) ?? 0) > 0;
              if (hasData || sid === ids[ids.length - 1]) gotUsage = u;
            }
          } catch {}
        }
        if (gotBreakdown && gotUsage) break;
      }

      const gotPersisted = await persistedPromise;
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
  }, [sessionId, candidateIdsKey, ownerConnId, profileSlug, refreshNonce]);

  // 4. Fetch multi-session / multi-profile persisted sessions ONLY when needed
  React.useEffect(() => {
    if (prefs.usageScope === 'session' || typeof host.listPersistedSessions !== 'function') {
      setScopedSessions([]);
      setScopeLoading(false);
      return;
    }

    let cancelled = false;
    setScopeLoading(true);
    const targetProfiles =
      prefs.usageScope === 'all'
        ? Array.from(new Set([...(profileNames.length > 0 ? profileNames : []), profileSlug]))
        : [profileSlug];

    Promise.all(
      targetProfiles.map((pName) => {
        const route = resolveRoute({ connectionId: ownerConnId, profile: pName }, pName);
        return host
          .listPersistedSessions(route, { profile: pName, limit: 500 })
          .then((res) => (Array.isArray(res?.sessions) ? res.sessions : []))
          .catch(() => []);
      })
    ).then((batches) => {
      if (cancelled) return;
      setScopedSessions(batches.flat());
      setScopeLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [prefs.usageScope, prefs.timeRange, ownerConnId, profileSlug, profileNames, refreshNonce]);

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
      const route = resolveRoute({ connectionId: ownerConnId, profile: profileSlug }, profileSlug);
      const res = await gwCall(route, 'session.compress', { session_id: sessionId });
      if (res?.status === 'aborted' || res?.compressed === false) {
        setCompactState('idle');
        setCompactMsg(t.compactSkipped);
      } else {
        setCompactState('done');
        setCompactMsg(res?.status === 'pending' ? t.compactQueued : t.compactDone);
        globalThis.setTimeout(() => setRefreshNonce((n) => n + 1), 800);
      }
    } catch (err) {
      setCompactState('error');
      setCompactMsg(err instanceof Error ? err.message : t.compactFailed);
    }
  }, [sessionId, busy, compactState, ownerConnId, profileSlug, t]);

  // ---- Derive Metrics ----
  const merged = mergeUsageSources(liveUsage, rpcUsage, persistedSession, breakdown);
  const categories = normalizeCategories(breakdown, prefs.themeSkin, t);
  const modelName = resolveModelName(liveUsage, rpcUsage, persistedSession, rawModel);
  const botName = botTitles[profileSlug] || profileSlug;
  const sessionCost = estimateSessionCost(merged, modelName);

  const isMultiSessionScope = prefs.usageScope !== 'session';
  const scopeLabel = buildScopeLabel(prefs, botName, profileNames.length, t);
  const scopedAgg = isMultiSessionScope
    ? aggregatePersistedSessions(scopedSessions, prefs.timeRange, candidateIds, merged, modelName)
    : null;

  const displayInput = isMultiSessionScope ? scopedAgg.input : merged.input;
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
    const hasTok = (displayInput ?? 0) > 0 || (displayOutput ?? 0) > 0;
    consumptionParts.push(
      h(
        'span',
        { key: 'tok', className: 'lub-chip-muted' },
        !hasTok
          ? '—'
          : prefs.tokenDisplay === 'total'
            ? fmtCompact(displayTotal ?? 0)
            : `↑${fmtCompact(displayInput ?? 0)} ↓${fmtCompact(displayOutput ?? 0)}`
      )
    );
  }
  if (prefs.showCost) {
    consumptionParts.push(
      h(
        'span',
        { key: 'cost', className: 'lub-chip-primary' },
        displayCostAmount != null ? fmtCurrency(displayCostAmount, displayCostEstimated, prefs) : '—'
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
            kvRow('in', t.input, fmtFull(displayInput)),
            kvRow('out', t.output, fmtFull(displayOutput)),
            kvRow('tot', t.total, fmtFull(displayTotal)),
            kvRow('cnt', t.sessions, t.sessionsUnit(scopedAgg.sessionCount))
          )
        : h(
            'div',
            { className: 'lub-grid' },
            kvRow('in', t.input, fmtFull(merged.input)),
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
            botName,
            profileCount: profileNames.length,
            initialTab: configInitialTab,
            policy,
            policySchema,
            policyBusy,
            policyNote,
            onSavePolicy: handleSavePolicy,
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
    'Always-on context runway, Claude Code /context-style breakdown, multi-bot & multi-currency spend tracking, and in-place compaction & memory policy controls for Hermes Desktop.',
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
