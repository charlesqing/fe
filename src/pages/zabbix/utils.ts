import _ from 'lodash';
import moment from 'moment-timezone';

import { DEFAULT_HOST_PAGE_SIZE, DEFAULT_ITEM_PAGE_SIZE, DELTA_DOWN_COLOR, DELTA_UP_COLOR } from './constants';
import type { ZabbixHostSearchRow, ZabbixLatestDataRow, ZabbixSeries } from './services';

/** 通用内存分页：返回当前页数据与总数（total 为过滤后精确值） */
export function paginate<T>(rows: T[], current: number, pageSize: number): { list: T[]; total: number } {
  const total = rows.length;
  if (total === 0 || current < 1) {
    return { list: [], total };
  }
  const start = (current - 1) * pageSize;
  if (start >= total) {
    return { list: [], total };
  }
  return { list: rows.slice(start, start + pageSize), total };
}

/** 查询条件重置后的初始分页状态 */
export function initialHostPage() {
  return { current: 1, pageSize: DEFAULT_HOST_PAGE_SIZE };
}

export function initialItemPage() {
  return { current: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE };
}

/** displayName：优先显示名，回退技术名 */
export function hostDisplayName(row: Pick<ZabbixHostSearchRow, 'name' | 'host'>): string {
  return row.name || row.host || '-';
}

/** 主机地址展示：ip:port，缺 IP 时用 DNS / 占位符 */
export function hostAddress(row: Pick<ZabbixHostSearchRow, 'ip' | 'port'>): string {
  if (!row.ip) {
    return '-';
  }
  return row.port ? `${row.ip}:${row.port}` : row.ip;
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
const RATE_UNITS = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];

// 这些单位按 1024 进制缩放；其余（含 %、s、V 等）只做小数位裁剪。
const BYTE_UNIT_SET = new Set(['B', 'bytes', 'byte']);
const RATE_UNIT_SET = new Set(['bps', 'bit/s', 'Bps', 'bytes/s']);

/** 去掉无意义的小数位：1.500 → 1.5，2.000 → 2 */
function trimNumber(value: number, maxDigits = 3): string {
  if (!_.isFinite(value)) {
    return '-';
  }
  const abs = Math.abs(value);
  // 极小值保留科学计数法，避免显示成 0
  if (abs !== 0 && abs < 0.0001) {
    return value.toExponential(2);
  }
  const fixed = abs >= 1000 ? value.toFixed(0) : value.toFixed(maxDigits);
  return _.trimEnd(_.trimEnd(fixed, '0'), '.');
}

/**
 * 按单位把数值换算成可读文本（与 Zabbix 最新数据列的展示习惯一致）：
 *   - 字节类按 1024 缩放（4778909696 B → 4.45 GB）
 *   - 速率类按 1000 缩放（1260 bps → 1.26 Kbps）
 *   - 其余保留原值，仅裁剪小数位
 */
export function formatNumber(value: number, units = ''): string {
  if (!_.isFinite(value)) {
    return '-';
  }
  const abs = Math.abs(value);

  if (BYTE_UNIT_SET.has(units) && abs >= 1024) {
    let scaled = value;
    let idx = 0;
    while (Math.abs(scaled) >= 1024 && idx < BYTE_UNITS.length - 1) {
      scaled /= 1024;
      idx += 1;
    }
    return `${trimNumber(scaled, 2)} ${BYTE_UNITS[idx]}`;
  }

  if (RATE_UNIT_SET.has(units) && abs >= 1000) {
    let scaled = value;
    let idx = 0;
    while (Math.abs(scaled) >= 1000 && idx < RATE_UNITS.length - 1) {
      scaled /= 1000;
      idx += 1;
    }
    return `${trimNumber(scaled, 2)} ${RATE_UNITS[idx]}`;
  }

  const text = trimNumber(value);
  return units ? `${text} ${units}` : text;
}

/**
 * 最新数据列的展示值：
 *   1. 空值 → 占位符
 *   2. 命中值映射（valuemap）→ 直接显示映射文本（如 Up / Down）
 *   3. 数值 → 按单位换算
 *   4. 非数值（文本/日志）→ 原样显示
 */
export function formatLatestValue(row: Pick<ZabbixLatestDataRow, 'lastvalue' | 'lastvalue_display' | 'units'>): string {
  const raw = row.lastvalue;
  if (raw === undefined || raw === null || raw === '') {
    return '—';
  }
  const display = row.lastvalue_display;
  if (display && display !== raw) {
    return display;
  }
  const num = Number(raw);
  // 纯数值（含科学计数法）才做单位换算；"Unsupported" 之类的占位串原样展示
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(String(raw).trim()) && _.isFinite(num)) {
    return formatNumber(num, row.units);
  }
  return raw;
}

export interface DeltaView {
  text: string;
  color?: string;
  direction: 'up' | 'down' | 'flat' | 'none';
}

/**
 * 变化量展示：▲/▼ + 绝对值 +（百分比）。
 * 增量为正用暖色、为负用冷色（与中文语境"增红减绿"一致）。
 */
export function formatDelta(row: Pick<ZabbixLatestDataRow, 'change' | 'change_pct' | 'units'>): DeltaView {
  const { change, change_pct: pct } = row;
  if (change === null || change === undefined || !_.isFinite(change)) {
    return { text: '-', direction: 'none' };
  }
  if (change === 0) {
    return { text: '0', direction: 'flat' };
  }
  const arrow = change > 0 ? '▲' : '▼';
  const magnitude = formatNumber(Math.abs(change), row.units);
  const pctText = pct === null || pct === undefined || !_.isFinite(pct) ? '' : ` (${Math.abs(pct).toFixed(2)}%)`;
  return {
    text: `${arrow} ${magnitude}${pctText}`,
    color: change > 0 ? DELTA_UP_COLOR : DELTA_DOWN_COLOR,
    direction: change > 0 ? 'up' : 'down',
  };
}

/**
 * 最近检查时间的相对展示（Zabbix 最新数据列）。
 * clock 为 unix 秒；nowMs 可注入以便单测。
 */
export function formatRelativeTime(clock: number, nowMs: number = Date.now()): string {
  if (!clock || clock <= 0) {
    return '从未';
  }
  const diff = Math.floor(nowMs / 1000) - clock;
  if (diff < 0) {
    return '刚刚';
  }
  if (diff < 60) {
    return `${diff} 秒前`;
  }
  if (diff < 3600) {
    return `${Math.floor(diff / 60)} 分钟前`;
  }
  if (diff < 86400) {
    return `${Math.floor(diff / 3600)} 小时前`;
  }
  if (diff < 86400 * 30) {
    return `${Math.floor(diff / 86400)} 天前`;
  }
  const d = new Date(clock * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** series 展示名：优先 itemname，回退 key_ / itemid */
export function seriesLabel(metric: Record<string, string>): string {
  return metric?.itemname || metric?.key_ || metric?.itemid || 'unknown';
}

/**
 * series 的 [unix秒, 数值] 点集 → uPlot AlignedData 需要的两列。
 * 秒级时间戳与 uPlot 的 time scale 契约一致，无需转换；
 * 非数值点跳过（与后端 historiesToDataResp 的防御一致）。
 */
export function seriesToUplotData(values: [number, number][]): [number[], (number | null)[]] {
  const points = _.filter(values, ([clock, value]) => _.isFinite(clock) && _.isFinite(value) && clock > 0).sort((a, b) => a[0] - b[0]);
  return [_.map(points, (p) => p[0]), _.map(points, (p) => p[1])];
}

export interface SeriesStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  last: number;
}

/** 趋势图统计数据摘要（无数据时返回 null） */
export function seriesStats(series: ZabbixSeries[]): SeriesStats | null {
  const values: number[] = [];
  _.forEach(series, (s) => {
    _.forEach(s.values, ([clock, value]) => {
      if (_.isFinite(clock) && _.isFinite(value)) {
        values.push(value);
      }
    });
  });
  if (values.length === 0) {
    return null;
  }
  return {
    count: values.length,
    min: _.min(values) as number,
    max: _.max(values) as number,
    avg: _.sum(values) / values.length,
    last: values[values.length - 1],
  };
}

/** 关键词本地高亮用的安全转义（避免正则元字符） */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ---------------------------------------------------------------------------
 * X 轴时间刻度：对齐 Zabbix 原生图形的刻度间隔
 * ---------------------------------------------------------------------------
 * 算法复刻自 Zabbix 7.0 `CLineGraphDraw::drawDateTimeIntervals()`
 * （include/classes/graphdraw/CLineGraphDraw.php）：
 *   1. preferred = period * cell_width / sizeX（cell_width=30 为 Zabbix 默认
 *      网格列宽；sizeX 取 Zabbix 弹窗图形的基准绘图区宽度）；
 *   2. 候选 sub-interval 取自 Zabbix 的主/子间隔表（展开为秒）：
 *      1s/5s/10s/30s、1m/2m/5m/15m/30m、1h/3h/6h/12h、1d、3d/1w/2w、
 *      30d/90d/120d/180d、1y/5y；
 *   3. 先找满足最小可容纳间隔（minInterval，竖排标签不重叠的下限）的候选，
 *      再在其中取与 preferred 倍率最接近者；
 *   4. 刻度按本地时区零点/间隔边界对齐（Zabbix 以天为锚点，所有 >=3h 的
 *      子间隔均整除一天）。
 * 实测与 Zabbix 7.0 原生图一致：1h→2min、3h→5min、6h→15min、12h→15min、
 * 24h→30min、7d→12h。
 */
const ZABBIX_CELL_WIDTH = 30;
const ZABBIX_BASE_SIZE_X = 1050;
const ZABBIX_LABEL_WIDTH = 9;

const ZABBIX_SUB_INTERVALS = [
  1, 5, 10, 30,
  60, 120, 300, 900, 1800,
  3600, 10800, 21600, 43200,
  86400,
  259200, 604800, 1209600,
  2592000, 7776000, 10368000, 15552000,
  31536000, 157680000,
];

const DAY_SECONDS = 86400;

/** 选取与 Zabbix 原生图形一致的刻度间隔（秒）。periodSec 为窗口跨度。 */
export function pickZabbixTimeIncr(periodSec: number): number {
  if (!_.isFinite(periodSec) || periodSec <= 0) {
    return 60;
  }
  const preferred = (periodSec * ZABBIX_CELL_WIDTH) / ZABBIX_BASE_SIZE_X;
  const minInterval = (ZABBIX_LABEL_WIDTH * periodSec * 2) / ZABBIX_BASE_SIZE_X;

  let best = ZABBIX_SUB_INTERVALS[ZABBIX_SUB_INTERVALS.length - 1];
  let bestTs = 0;
  let bestProp = Infinity;
  for (const ts of ZABBIX_SUB_INTERVALS) {
    const prop = Math.max(preferred, ts) / Math.min(preferred, ts);
    // Zabbix 规则：还没找到满足 minInterval 的候选时优先取更大者，之后按接近度选
    const isBetter = bestTs < minInterval ? ts > bestTs : prop < bestProp;
    if (isBetter) {
      best = ts;
      bestTs = ts;
      bestProp = prop;
    }
  }
  return best;
}

/** Zabbix 风格 X 轴刻度（unix 秒，升序，裁剪到窗口内） */
export function zabbixTimeSplits(startSec: number, endSec: number): number[] {
  const start = Math.ceil(startSec);
  const end = Math.floor(endSec);
  if (!_.isFinite(start) || !_.isFinite(end) || end <= start) {
    return [];
  }
  const incr = pickZabbixTimeIncr(end - start);

  let first: number;
  if (incr >= 3 * 3600) {
    // >=3h 的间隔以本地时区零点为锚（与 Zabbix 的 P1D 对齐一致），
    // 避免 epoch 对齐在东八区出现 02:00 / 08:00 这类偏移刻度
    const dayStart = moment.unix(start).startOf('day').unix();
    first = dayStart + Math.ceil((start - dayStart) / incr) * incr;
  } else {
    first = Math.ceil(start / incr) * incr;
  }

  const splits: number[] = [];
  for (let t = first; t <= end; t += incr) {
    splits.push(t);
  }
  return splits;
}

/**
 * 问题持续时长：进行中的问题按 now - clock 计（recoverTime 可传入恢复时刻）。
 * 输出与 Zabbix 一致的"Xd Xh Xm"风格。
 */
export function formatDuration(clock: number, endTime: number = Date.now() / 1000): string {
  if (!clock || clock <= 0) {
    return '-';
  }
  let diff = Math.floor(endTime - clock);
  if (diff < 0) {
    diff = 0;
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
