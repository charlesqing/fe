import _ from 'lodash';

/** 上下文窗口半径：锚点日志前后各 2 小时（与 Loki 插件 ContextViewer 一致） */
const TWO_HOURS_NS = BigInt(2 * 60 * 60) * BigInt(1_000_000_000);

function toMs(ns: bigint) {
  return Number(ns / BigInt(1_000_000));
}

/**
 * 以锚点日志的纳秒时间戳为中心，取前后各 2 小时的查询窗口。
 * 返回毫秒值（OpenObserve 后端 start/end 的契约为毫秒，见 toMicros）。
 *
 * 注意：纳秒级的边界排除（backward 止于 anchor-1ns、forward 起于 anchor+1ns）
 * 在毫秒契约下会塌缩——backward.end = floor(anchor-1ns) = anchorMs-1，
 * 而 forward.start = floor(anchor+1ns) = anchorMs，即前向窗口仍覆盖锚点所在
 * 毫秒，锚点可能随前向查询重新出现。真正的去重保证在 mergeContextLogs
 * （按「纳秒时间戳 + 扁平字段」身份 uniqBy），这里只做尽力收窄。
 */
export function getContextTimeRanges(timestampNs?: string) {
  if (!timestampNs || !/^\d+$/.test(timestampNs)) return null;
  const currentNs = BigInt(timestampNs);
  return {
    backward: {
      start: toMs(currentNs > TWO_HOURS_NS ? currentNs - TWO_HOURS_NS : BigInt(0)),
      end: toMs(currentNs > BigInt(0) ? currentNs - BigInt(1) : BigInt(0)),
    },
    forward: {
      start: toMs(currentNs + BigInt(1)),
      end: toMs(currentNs + TWO_HOURS_NS),
    },
  };
}

/** 上下文行身份：纳秒时间戳 + 扁平字段序列化（用于去重与定位当前日志） */
export function getLogIdentity(log?: Record<string, any>) {
  if (!log) return '';
  const flat = _.omit(log, ['timestamp', '__timestamp__', '__n9e_raw_n9e__', '__n9e_id_n9e__']);
  const sorted = _.fromPairs(
    _.sortBy(_.keys(flat)).map((key) => [key, flat[key]]),
  );
  return `${log.__timestamp__ || ''}|${JSON.stringify(sorted)}`;
}

function compareTimestampNs(a?: string, b?: string) {
  const ta = a && /^\d+$/.test(a) ? a : '0';
  const tb = b && /^\d+$/.test(b) ? b : '0';
  if (ta.length !== tb.length) return ta.length - tb.length;
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

/** 合并「更早 + 当前 + 更新」三段上下文，按时间升序去重 */
export function mergeContextLogs(
  currentLog: Record<string, any>,
  backwardLogs: Record<string, any>[],
  forwardLogs: Record<string, any>[],
): Record<string, any>[] {
  const logs = [...backwardLogs, currentLog, ...forwardLogs].sort((a, b) => compareTimestampNs(a.__timestamp__, b.__timestamp__));
  // 包一层箭头函数：getLogIdentity 的可选参数会让 lodash 的 uniqBy 把 T 推断成
  // Record<string, any> | undefined，与函数返回类型不匹配
  return _.uniqBy(logs, (item) => getLogIdentity(item));
}
