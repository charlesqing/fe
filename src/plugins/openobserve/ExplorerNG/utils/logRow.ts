import _ from 'lodash';
import moment from 'moment';

/**
 * OpenObserve 日志行结构转换。
 *
 * 后端 /api/n9e/logs-query 返回的是 lokikit 归一化结构：
 *   { timestamp: <ms>, __timestamp__: <ns字符串>, line: <文本>, labels: {...}, parsed_fields: {...} }
 * 其中 labels 即 OpenObserve 原始行（全部字段，值被字符串化）。
 *
 * 此前插件把该结构直接喂给 LogsViewer，列表/详情页展示的是 timestamp/line/labels
 * 这类内部包装字段，与 OpenObserve 原版 UI（展示原始扁平行）不一致。本模块参照
 * Loki 插件的平台模式把 labels/parsed_fields 拍平为顶层字段，并做两件保真处理：
 *   1. 数值型字符串还原为 number（_timestamp 微秒、code、took 等与原版展示一致）；
 *   2. __n9e_raw_n9e__ 指向扁平行，详情页 JSON Tab 展示的就是原始行结构。
 */

/** 后端归一化日志结构（lokikit.NormalizedLog） */
export interface NormalizedLog {
  /** 毫秒时间戳 */
  timestamp?: number;
  /** 纳秒时间戳（字符串） */
  __timestamp__?: string;
  /** 提取出的日志文本行 */
  line?: string;
  /** OpenObserve 原始行（字段 → 字符串值） */
  labels?: Record<string, string>;
  parsed_fields?: Record<string, string>;
  [key: string]: any;
}

/**
 * 数值型字符串还原为 number。仅还原无前导零的整数字面量且可被双精度安全表示，
 * 避免把 "007" 这类标识符改成 7、把超长数字（如 19 位纳秒戳）精度截断。
 */
export function toNativeValue(value: any): any {
  if (typeof value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(value)) {
    return value;
  }
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : value;
}

/**
 * 把后端归一化日志转换为前端展示行：
 * - labels/parsed_fields 拍平为顶层字段（值还原原生类型）；
 * - 保留 timestamp/__timestamp__（时间列排序、身份识别用，展示层已过滤）；
 * - __n9e_raw_n9e__ 指向扁平行（详情页 JSON Tab 的展示内容）；
 * - __n9e_id_n9e__ 为行唯一键。
 */
export function transformLogRow(item: NormalizedLog): Record<string, any> {
  const flat: Record<string, any> = {};
  _.forEach({ ...(item.labels || {}), ...(item.parsed_fields || {}) }, (value, key) => {
    flat[key] = toNativeValue(value);
  });
  return {
    ...flat,
    timestamp: item.timestamp,
    __timestamp__: item.__timestamp__,
    __n9e_raw_n9e__: flat,
    __n9e_id_n9e__: _.uniqueId('log_id_'),
  };
}

/**
 * 时间字段值格式化（时间列 / 详情抽屉标题共用）。
 *
 * OpenObserve 的 _timestamp 是微秒整数，但不同采集链路可能落成秒/毫秒/微秒/纳秒，
 * 按数量级推断单位后再格式化。此前直接用 moment(值) 把微秒当毫秒解析，时间列
 * 会显示错误年份（字段缺失时更会退化成"当前时间"）。
 */
export function formatTimeFieldValue(value?: string | number): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return String(value);
  }
  const abs = Math.abs(num);
  let ms: number;
  if (abs >= 1e17) {
    ms = num / 1e6; // 纳秒
  } else if (abs >= 1e14) {
    ms = num / 1e3; // 微秒
  } else if (abs >= 1e11) {
    ms = num; // 毫秒
  } else {
    ms = num * 1000; // 秒
  }
  return moment(ms).format('MM-DD HH:mm:ss.SSS');
}
