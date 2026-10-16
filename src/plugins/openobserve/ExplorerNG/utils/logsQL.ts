import _ from 'lodash';

import { OpenObserveAggregation, OpenObserveFilter, OpenObserveMetricBuilderState, OpenObserveRawBuilderState } from '../types';

interface RenderLogsQLOptions {
  multiline?: boolean;
}

// OpenObserve 后端 buildLogSQL / QueryData 只接受标准 SQL：
// - 日志原文（raw）：Builder 产出 WHERE 片段，后端包成 SELECT * FROM "stream" WHERE <time> AND (<片段>)
// - 统计图表（metric）：Builder 产出完整 SELECT（含 FROM "stream" / GROUP BY），后端 SELECT 透传
// 因此这里统一生成标准 SQL，而非 VictoriaLogs 风格的 LogSQL 管道语法。

function escapeSQLValue(value: any): string {
  if (_.isNumber(value) || _.isBoolean(value)) return String(value);
  const str = _.toString(value);
  // 简单标识符（字段/词）不加引号；其余按字符串单引号包裹，单引号转义为 ''
  if (/^[A-Za-z0-9_.:@/-]+$/.test(str)) return `'${str}'`;
  return `'${str.replace(/'/g, "''")}'`;
}

function renderFilter(filter: OpenObserveFilter): string {
  const field = _.trim(filter.field);
  if (!field) return '';
  const value = filter.value;

  switch (filter.op) {
    case 'eq':
      return `${field} = ${escapeSQLValue(value)}`;
    case 'neq':
      return `${field} != ${escapeSQLValue(value)}`;
    case 'contains':
      return `${field} LIKE ${escapeSQLValue(`%${value}%`)}`;
    case 'not_contains':
      return `${field} NOT LIKE ${escapeSQLValue(`%${value}%`)}`;
    case 'regex':
      return `regexp_like(${field}, ${escapeSQLValue(value)})`;
    case 'not_regex':
      return `NOT regexp_like(${field}, ${escapeSQLValue(value)})`;
    case 'gt':
      return `${field} > ${escapeSQLValue(value)}`;
    case 'gte':
      return `${field} >= ${escapeSQLValue(value)}`;
    case 'lt':
      return `${field} < ${escapeSQLValue(value)}`;
    case 'lte':
      return `${field} <= ${escapeSQLValue(value)}`;
    case 'exists':
      return `${field} IS NOT NULL`;
    case 'not_exists':
      return `${field} IS NULL`;
    default:
      return '';
  }
}

// 日志原文模式：产出标准 SQL 的 WHERE 片段（不含 SELECT/FROM）。
// 后端 buildLogSQL 会补上 SELECT * FROM "stream" WHERE <时间> AND (<本片段>)。
export function renderLogsQL(builder?: OpenObserveRawBuilderState): string {
  const filters = _.compact(_.map(builder?.filters || [], renderFilter));
  if (_.isEmpty(filters)) return '*';
  return _.join(filters, ' AND ');
}

function renderAggregation(aggregation: OpenObserveAggregation): string {
  const alias = _.trim(aggregation.alias) || aggregation.func;
  if (aggregation.func === 'count') return `count(*) AS ${alias || 'count'}`;
  if (aggregation.func === 'count_uniq') return `count(DISTINCT ${aggregation.field}) AS ${alias || 'count_uniq'}`;
  if (aggregation.func === 'quantile') return `approx_percentile(${aggregation.field}, ${aggregation.params?.quantile ?? 0.99}) AS ${alias || 'quantile'}`;
  if (!aggregation.field) return '';
  return `${aggregation.func}(${aggregation.field}) AS ${alias}`;
}

export function inferMetricTimeseriesKeys(builder?: OpenObserveMetricBuilderState) {
  return {
    valueKey: _.compact(_.map(builder?.aggregations || [], (item) => _.trim(item.alias) || item.func)),
    labelKey: _.compact(builder?.groupBy || []),
  };
}

// 按顶层逗号拆分（忽略括号内的逗号，例如 date_trunc('minute', _timestamp) 内的逗号）。
function splitTopLevelCommas(input: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of input) {
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth = Math.max(depth - 1, 0);
    }
    if (char === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return _.map(result, (item) => _.trim(item));
}

// 统计图表模式：从查询字符串反推时序图的坐标轴字段。
// 行转 series 时，非数值列作 label、数值列作 value；这里解析 GROUP BY（label）与 聚合 AS 别名（value）。
export function inferMetricTimeseriesKeysFromQuery(query?: string) {
  const q = _.trim(query || '');
  if (!q) {
    return {
      valueKey: [] as string[],
      labelKey: [] as string[],
    };
  }

  // labelKey：GROUP BY 子句中的列（排除时间桶表达式与 _timestamp 别名）
  let labelKey: string[] = [];
  const groupMatch = q.match(/\bgroup\s+by\s+([\s\S]*?)(?:\border\s+by\b|\blimit\b|$)/i);
  if (groupMatch) {
    labelKey = _.compact(
      _.map(splitTopLevelCommas(groupMatch[1]), (item) => {
        const col = _.trim(item);
        if (/^date_trunc\s*\(/i.test(col)) return '';
        if (col === '_timestamp') return '';
        return col;
      }),
    );
  }

  // valueKey：聚合函数的 AS 别名
  let valueKey: string[] = _.uniq(
    _.compact(
      _.map([...q.matchAll(/\bas\s+([A-Za-z_][A-Za-z0-9_.]*)/gi)], (match) => {
        const alias = match[1];
        return alias === '_timestamp' ? '' : alias;
      }),
    ),
  );

  if (_.isEmpty(valueKey) && /\bcount\s*\(\s*\*?\s*\)/i.test(q)) {
    valueKey.push('count');
  }

  return {
    valueKey,
    labelKey,
  };
}

// 原始 Builder 状态 → 标准 SQL 完整 SELECT（统计图表模式）。
// 含时间桶（date_trunc）以便时序图按时间轴绘制；FROM "stream" 由调用方传入（后端 SELECT 透传不会注入 stream）。
export function renderMetricLogsQL(builder?: OpenObserveMetricBuilderState, options?: RenderLogsQLOptions, stream?: string): string {
  const whereFilters = _.compact(_.map(builder?.filters || [], renderFilter));
  const baseWhere = whereFilters.length ? _.join(whereFilters, ' AND ') : '';
  const aggregations = _.compact(_.map(builder?.aggregations || [], renderAggregation));
  if (_.isEmpty(aggregations)) {
    // 没有聚合就退化为 raw 的 WHERE 片段
    return renderLogsQL({ filters: builder?.filters || [] });
  }

  const groupBy = _.filter(builder?.groupBy || [], Boolean);
  const timeBucket = `date_trunc('minute', _timestamp) AS "_timestamp"`;

  const selectCols = [timeBucket];
  if (!_.isEmpty(groupBy)) selectCols.push(_.join(groupBy, ', '));
  selectCols.push(_.join(aggregations, ', '));

  const groupByCols = ['date_trunc(\'minute\', _timestamp)', ...groupBy];

  let sql = `SELECT ${_.join(selectCols, ', ')} FROM "${stream || ''}"`;
  if (baseWhere) sql += ` WHERE ${baseWhere}`;
  sql += ` GROUP BY ${_.join(groupByCols, ', ')} ORDER BY "_timestamp"`;
  if (builder?.limit) sql += ` LIMIT ${builder.limit}`;

  if (options?.multiline) {
    return sql
      .replace(/\bFROM\b/i, '\nFROM')
      .replace(/\bWHERE\b/i, '\nWHERE')
      .replace(/\bGROUP BY\b/i, '\nGROUP BY')
      .replace(/\bORDER BY\b/i, '\nORDER BY')
      .replace(/\bLIMIT\b/i, '\nLIMIT');
  }
  return sql;
}

// 依据查询内容判断是日志原文（raw）还是统计图表（metric）。
// 标准 SQL 聚合查询（含 GROUP BY）即视为 metric；兼容遗留 LogSQL 管道写法。
export function classifyExplorerMode(userQL?: string): 'raw' | 'metric' {
  const q = _.trim(userQL || '');
  const lower = _.toLower(q);
  if (lower === '') return 'raw';

  // 标准 SQL 聚合
  if (/\bgroup\s+by\b/.test(lower)) return 'metric';

  // 遗留 LogSQL 管道
  if (/\|\s*stats\b/.test(lower)) return 'metric';
  if (lower.includes('|')) {
    if (/\|\s*(sort\s+by|limit|offset|fields|rename)\b/.test(lower)) return 'metric';
    if (/\|\s*(filter|extract|replace|json|pack_json|unpack_json)\b/.test(lower)) return 'raw';
    return 'metric';
  }

  return 'raw';
}
