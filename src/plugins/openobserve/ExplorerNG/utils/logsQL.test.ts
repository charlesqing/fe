import { classifyExplorerMode, inferMetricTimeseriesKeysFromQuery, renderLogsQL, renderMetricLogsQL } from './logsQL';

describe('OpenObserve ExplorerNG logsQL utils (standard SQL)', () => {
  test.each([
    ['', 'raw'],
    ['   ', 'raw'],
    ['*', 'raw'],
    ['level = \'error\'', 'raw'],
    ['status = 500 AND level = \'error\'', 'raw'],
    ['a = 1 AND b != 2', 'raw'],
    // 引号字符串字面量内的竖线不是管道符，必须保持 raw
    ['regexp_like(msg, \'timeout|fail\')', 'raw'],
    ['msg LIKE \'%a|b%\'', 'raw'],
    ['level = \'error\' AND regexp_like(msg, \'timeout|fail\')', 'raw'],
    ['SELECT count(*) FROM "stream" GROUP BY service', 'metric'],
    ['select service, count(*) as count from "logs" group by service', 'metric'],
    ['SELECT date_trunc(\'minute\', _timestamp) AS "_timestamp", service, count(*) AS count FROM "s" GROUP BY date_trunc(\'minute\', _timestamp), service', 'metric'],
    // 无 GROUP BY 的单值聚合 SELECT 也是 metric（后端透传完整 SELECT，前端须按 metric 渲染）
    ['SELECT count(*) FROM "s"', 'metric'],
    ['select sum(latency) as total from "s"', 'metric'],
    ['SELECT approx_percentile(latency, 0.99) AS p99 FROM "s"', 'metric'],
    // 纯投影查询（无聚合函数）仍是 raw
    ['SELECT * FROM "s"', 'raw'],
    ['SELECT service, msg FROM "s"', 'raw'],
    // 遗留 LogSQL 管道写法仍识别为 metric
    ['* | stats by (service) count() as count', 'metric'],
    ['* | sort by (_time)', 'metric'],
  ])('classifies %s as %s', (query, mode) => {
    expect(classifyExplorerMode(query)).toBe(mode);
  });

  it('renders raw WHERE fragment from builder filters', () => {
    const query = renderLogsQL({
      filters: [
        { id: '1', field: 'level', op: 'eq', value: 'error' },
        { id: '2', field: 'status', op: 'gt', value: 500 },
        { id: '3', field: 'msg', op: 'contains', value: 'timeout' },
      ],
    });
    // LIKE 显式声明 ESCAPE '\'，避免用户值里的 %/_ 被当通配符
    expect(query).toBe(`level = 'error' AND status > 500 AND msg LIKE '%timeout%' ESCAPE '\\'`);
  });

  it('escapes LIKE wildcards in user values (% and _ are literal)', () => {
    const query = renderLogsQL({
      filters: [{ id: '1', field: 'msg', op: 'contains', value: '100%_done' }],
    });
    expect(query).toBe(String.raw`msg LIKE '%100\%\_done%' ESCAPE '\'`);
  });

  it('escapes single quotes inside LIKE values', () => {
    const query = renderLogsQL({
      filters: [{ id: '1', field: 'msg', op: 'contains', value: "it's" }],
    });
    expect(query).toBe(String.raw`msg LIKE '%it''s%' ESCAPE '\'`);
  });

  it('renders empty raw fragment as * (match all)', () => {
    expect(renderLogsQL({ filters: [] })).toBe('*');
  });

  it('renders regex filter as regexp_like with escaped value', () => {
    const query = renderLogsQL({
      filters: [{ id: '1', field: 'msg', op: 'regex', value: 'timeout|fail' }],
    });
    expect(query).toBe(`regexp_like(msg, 'timeout|fail')`);
  });

  it('renders metric SELECT with time bucket, group by and aggregations', () => {
    const query = renderMetricLogsQL(
      {
        filters: [{ id: '1', field: 'level', op: 'eq', value: 'error' }],
        aggregations: [{ id: '2', func: 'count', alias: 'count' }],
        groupBy: ['service'],
        limit: 10,
        vizType: 'table',
      },
      { multiline: true },
      'mystream',
    );

    expect(query).toContain('SELECT');
    expect(query).toContain(`date_trunc('minute', _timestamp) AS "_timestamp"`);
    expect(query).toContain('service');
    expect(query).toContain('count(*) AS count');
    expect(query).toContain('FROM "mystream"');
    expect(query).toContain('WHERE level = \'error\'');
    expect(query).toContain('GROUP BY date_trunc(\'minute\', _timestamp), service');
    expect(query).toContain('ORDER BY "_timestamp"');
    expect(query).toContain('LIMIT 10');
    expect(classifyExplorerMode(query)).toBe('metric');
  });

  it('renders metric SELECT with the datasource-configured time field', () => {
    const query = renderMetricLogsQL(
      {
        filters: [],
        aggregations: [{ id: '2', func: 'count', alias: 'count' }],
        groupBy: ['service'],
        vizType: 'table',
      },
      undefined,
      'mystream',
      '_time',
    );
    expect(query).toContain(`date_trunc('minute', _time) AS "_timestamp"`);
    expect(query).toContain('GROUP BY date_trunc(\'minute\', _time), service');
  });

  it('infers timeseries keys from a metric SQL', () => {
    const query = renderMetricLogsQL(
      {
        filters: [],
        aggregations: [{ id: '2', func: 'count', alias: 'count' }],
        groupBy: ['service'],
        vizType: 'timeseries',
      },
      undefined,
      'mystream',
    );
    const keys = inferMetricTimeseriesKeysFromQuery(query);
    expect(keys.labelKey).toEqual(['service']);
    expect(keys.valueKey).toEqual(['count']);
  });
});
