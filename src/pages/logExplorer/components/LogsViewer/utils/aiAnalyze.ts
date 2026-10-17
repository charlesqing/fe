import _ from 'lodash';

/**
 * AI 日志分析的内容预处理（日志详情页「AI 分析」按钮，见 Raw.tsx handleAiAnalyze）。
 *
 * 背景：该功能最初把原始日志 JSON 直接塞进 prompt。实测两个问题：
 *   1. epoch 时间戳（微秒/毫秒）交给 LLM 自己换算——模型对这类换算不可靠，
 *      曾把 1786801681627（2026-08-15）误算成 2026-11，还捏造了日志里
 *      根本不存在的 ISO 时间字段，进而得出"跨年份矛盾"的错误结论；
 *   2. prompt 无任何约束，模型自发增加检查项，输出格式也不稳定（如裸 JSON）。
 *
 * 因此本模块做三件事：
 *   1. 原始 JSON 原样保留（模型需要完整字段上下文）；
 *   2. 顶层 epoch 时间字段换算为 ISO 可读时间，以 `<字段>_readable` 注入，
 *      并在文末附「时间字段换算」清单——把现成结果喂给模型，不让它做算术；
 *   3. 追加「分析要求」：只依据提供的内容、禁止编造字段、按 问题/原因/建议 分节。
 *
 * 说明：换算清单与要求文案是中文 prompt 工程文本（非 UI chrome），不随界面
 * 语言切换——LLM 对中文指令的理解不受影响，回答语言由系统提示词按用户语言决定。
 */

/**
 * 平台内部键：行唯一键 / 原始行副本（各插件 ExplorerNG 注入，命名约定见
 * filteredFields.BUILTIN_FIELDS）与 lokikit 归一化包装字段 timestamp/__timestamp__
 * （对展示层与日志分析均无信息量：openobserve 等插件的原始行里已有 _timestamp）。
 *
 * 不过滤的后果：openobserve 的 __n9e_raw_n9e__ 是整行的副本，会让 prompt 体积
 * 翻倍且内容重复；时间字段换算也会为 timestamp/__timestamp__ 各生成一份换算清单。
 */
const INTERNAL_KEYS = ['__n9e_id_n9e__', '__n9e_raw_n9e__', '___id___', '___raw___', '__id__', '__raw__', 'timestamp', '__timestamp__'];

/** 单位 → 毫秒的换算除数，按 毫秒/秒/微秒/纳秒 顺序尝试：
 * 秒级要乘 1000 得毫秒（除数 1e-3），微秒/纳秒则除。
 * 只接受换算后年份落在 [2000, 2100] 的结果——同一数值按不同单位解释可能
 * 多个"合法"，合理年份区间即可过滤歧义（如 1786801681627000000 按毫秒/秒
 * 解释都越界，仅按微秒解释落在 2026）。
 */
const EPOCH_DIVISORS = [1, 1e-3, 1e3, 1e6];

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** 本地时间串，如 2026-08-15 21:48:01.627 (UTC+08:00) */
function formatLocalTime(d: Date): string {
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const tz = `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)} (${tz})`;
}

/**
 * 把看起来像 epoch 时间戳的值换算为可读时间；不像时间戳返回 undefined。
 * 数字与纯数字字符串均可；按 秒/毫秒/微秒/纳秒 解释，只接受换算后年份
 * 落在 [2000, 2100] 的结果——同一数值按不同单位解释可能多个"合法"，
 * 合理年份区间即可过滤歧义（如 1786801681627000000 仅按微秒解释才落在 2026，
 * 按毫秒解释会是公元 58625 年，按纳秒解释与按微秒同时刻但精度不同）。
 */
export function toReadableTime(value: unknown): string | undefined {
  let num: number | undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    num = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) num = parsed;
  }
  if (num === undefined) return undefined;

  for (const div of EPOCH_DIVISORS) {
    const d = new Date(num / div);
    const year = d.getFullYear();
    if (year >= 2000 && year <= 2100) {
      return `${d.toISOString()}（本地 ${formatLocalTime(d)}）`;
    }
  }
  return undefined;
}

/**
 * 生成送人 AI 的日志分析内容：原始 JSON + epoch 时间字段的可读换算 + 分析约束。
 * timeField 为数据源配置的时间字段（通常 _timestamp），会在换算清单里标注。
 */
export function buildAiAnalyzeContent(logItem: Record<string, any>, timeField?: string): string {
  // 先剔除平台内部键，再基于可见字段生成内容（详情页展示给用户的即这批字段）
  const log = _.omit(logItem, INTERNAL_KEYS);
  const enriched: Record<string, any> = { ...log };
  const notes: string[] = [];

  const keys = Object.keys(log);
  // 时间字段排在最前标注，其余按原顺序
  const orderedKeys = timeField && keys.includes(timeField) ? [timeField, ...keys.filter((k) => k !== timeField)] : keys;

  orderedKeys.forEach((key) => {
    const readable = toReadableTime(log[key]);
    if (!readable) return;
    enriched[`${key}_readable`] = readable;
    const mark = key === timeField ? '（日志时间字段）' : '';
    notes.push(`- ${key}${mark}: ${JSON.stringify(log[key])} = ${readable}`);
  });

  const timeBlock = notes.length ? `\n\n【时间字段换算】\n${notes.join('\n')}` : '';

  return `${JSON.stringify(enriched, null, 2)}${timeBlock}\n\n【分析要求】\n- 仅依据以上日志内容分析，禁止引用日志中不存在的字段或数值；时间字段已给出换算结果，不要自行推算或臆测时区/年份矛盾\n- 按「问题 / 原因 / 建议」三节输出，使用 Markdown`;
}
