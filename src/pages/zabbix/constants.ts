// Zabbix 主机查询页常量：分页、筛选枚举、状态映射与图表色板。
// 所有映射表的键都来自 Zabbix 的字符串枚举（JSON-RPC 以字符串返回数字）。

export const DEFAULT_HOST_PAGE_SIZE = 10;
export const DEFAULT_ITEM_PAGE_SIZE = 20;

// 图表默认时间窗：最近 6 小时（与 Zabbix 图形默认"过去 6 小时"一致）
export const DEFAULT_TIME_RANGE = { start: 'now-6h', end: 'now' } as const;

// 问题列表默认时间窗：最近 24 小时（problem.get 只返回活动问题，窗口主要用于限定起点）
export const DEFAULT_PROBLEM_TIME_RANGE = { start: 'now-24h', end: 'now' } as const;

// 最新数据自动刷新间隔（秒）；0 表示关闭
export const REFRESH_INTERVAL_OPTIONS = [
  { label: '关闭自动刷新', value: 0 },
  { label: '每 10 秒', value: 10 },
  { label: '每 30 秒', value: 30 },
  { label: '每 60 秒', value: 60 },
];

/** 主机状态：0 监控中 / 1 未监控（Zabbix host.status） */
export const HOST_STATUS_MAP: Record<string, string> = {
  '0': '监控中',
  '1': '未监控',
};

/** 监控项状态：0 已启用 / 1 已禁用（Zabbix item.status） */
export const ITEM_STATUS_MAP: Record<string, string> = {
  '0': '已启用',
  '1': '已禁用',
};

/** 监控项采集状态：0 正常 / 1 不支持（Zabbix item.state） */
export const ITEM_STATE_MAP: Record<string, string> = {
  '0': '正常',
  '1': '不支持',
};

/** 值类型（Zabbix item.value_type） */
export const VALUE_TYPE_MAP: Record<string, string> = {
  '0': '浮点小数',
  '1': '字符',
  '2': '日志',
  '3': '无符号整数',
  '4': '文本',
};

/** 接口类型（Zabbix interface.type），最新数据页只显示短标签 */
export const IFACE_TYPE_MAP: Record<string, string> = {
  '1': 'ZBX',
  '2': 'SNMP',
  '3': 'IPMI',
  '4': 'JMX',
};

/** 接口可用性（interface.available） */
export const AVAILABILITY_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '未知', color: '#8c8c8c' },
  '1': { label: '可用', color: '#52c41a' },
  '2': { label: '不可用', color: '#f5222d' },
};

/**
 * 最新数据工具栏的筛选预设。
 * Zabbix 的 item.get 支持 value_type / status / state 三个独立过滤维度，
 * 但运维实际只关心这几类组合，故收敛成一个下拉，避免表单过载。
 */
export const ITEM_FILTER_OPTIONS = [
  { label: '全部监控项', value: 'all' },
  { label: '数值型（可出图）', value: 'numeric' },
  { label: '文本 / 字符 / 日志', value: 'text' },
  { label: '采集不支持', value: 'unsupported' },
  { label: '已禁用', value: 'disabled' },
];

export type ItemFilterKey = 'all' | 'numeric' | 'text' | 'unsupported' | 'disabled';

/** 筛选预设 → 后端 /zabbix-latest-data 的 value_types/status/state 参数 */
export function itemFilterToQuery(key: ItemFilterKey): {
  value_types?: string[];
  status?: string;
  state?: string;
} {
  switch (key) {
    case 'numeric':
      return { value_types: ['0', '3'] };
    case 'text':
      return { value_types: ['1', '2', '4'] };
    case 'unsupported':
      return { state: '1' };
    case 'disabled':
      return { status: '1' };
    default:
      return {};
  }
}

// 平台图表色板（与仪表盘 Timeseries 一致的取色思路）
export const CHART_COLORS = [
  '#6C9EF8',
  '#F8C36C',
  '#7BD88A',
  '#F87C8D',
  '#9B7BD8',
  '#4FC2C2',
  '#C98B5E',
  '#8A94A6',
];

/** 问题严重级（Zabbix trigger.severity / problem.severity），色板对齐 Zabbix 前端 */
export const SEVERITY_MAP: Record<string, { label: string; color: string }> = {
  '0': { label: '未分级', color: '#97AAB3' },
  '1': { label: '信息', color: '#7499FF' },
  '2': { label: '警告', color: '#FFC859' },
  '3': { label: '一般严重', color: '#FFA059' },
  '4': { label: '严重', color: '#E97659' },
  '5': { label: '灾难', color: '#E45959' },
};

/** 问题确认状态（problem.acknowledged）：0 未确认 / 1 已确认 */
export const ACK_STATUS_MAP: Record<string, string> = {
  '0': '未确认',
  '1': '已确认',
};

// 数值变化的方向色：沿用中文语境"增红减绿"的直觉
export const DELTA_UP_COLOR = '#d4380d';
export const DELTA_DOWN_COLOR = '#389e0d';
