import request from '@/utils/request';
import { RequestMethod } from '@/store/common';
import { DatasourceCateEnum } from '@/utils/constant';

/** 主机组选项（/zabbix-hostgroups） */
export interface ZabbixHostGroup {
  groupid: string;
  name: string;
}

/** 主机行：对齐 Zabbix「监测 > 主机」列表的字段 */
export interface ZabbixHostSearchRow {
  hostid: string;
  host: string; // 技术名
  name: string; // 显示名
  status: string; // 0=监控中 1=未监控
  ip: string;
  port: string;
  iface_type: string; // 1=agent 2=SNMP 3=IPMI 4=JMX
  available: string; // 0=未知 1=可用 2=不可用
  groups: { groupid: string; name: string }[];
  problem_count: number; // 活动 PROBLEM 触发器数
}

/** 最新数据行（/zabbix-latest-data） */
export interface ZabbixLatestDataRow {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  units: string;
  lastvalue: string;
  lastvalue_display: string; // 已按值映射（valuemap）转换
  prevvalue: string;
  change: number | null;
  change_pct: number | null;
  lastclock: number; // unix 秒
  status: string; // 0=启用 1=禁用
  state: string; // 0=正常 1=不支持
  error: string;
  delay: string;
  description: string;
  chartable: boolean;
}

export interface ZabbixLatestDataResult {
  list: ZabbixLatestDataRow[];
  total: number;
  truncated: boolean;
}

/** ds-query 返回的序列（values 为 [unix 秒, 数值]） */
export interface ZabbixSeries {
  ref: string;
  metric: Record<string, string>;
  values: [number, number][];
}

/** 问题行：logs-query (query_type=problem) 的扁平化字段 */
export interface ZabbixProblemRow {
  eventid: string;
  name: string;
  clock: string; // unix 秒（字符串，与后端 JSON 序列化一致）
  severity: string; // 0-5
  acknowledged: string; // 0/1
  opdata: string; // 运行时操作数据（如当前值摘要）
  _time: string; // 毫秒时间戳（前端兼容字段）
  hostname?: string;
  [key: string]: string | undefined; // tag_<tag> 动态字段
}

/** 主机查询条件：名称 / 主机组 / IP / 状态，全部 AND */
export interface ZabbixHostSearchParams {
  keyword?: string;
  name?: string;
  ip?: string;
  status?: string;
  groupids?: string[];
  offset?: number;
  limit?: number;
}

/**
 * 主机检索：POST /zabbix-host-search
 *
 * Zabbix 的 host.get 无法在服务端匹配接口 IP，后端按 max_query_rows（默认
 * 1000）拉取主机清单后内存过滤并分页，total 为上限内的精确匹配数。
 */
export function searchZabbixHosts(data: { cate: DatasourceCateEnum; datasource_id: number } & ZabbixHostSearchParams): Promise<{ list: ZabbixHostSearchRow[]; total: number; truncated: boolean }> {
  return request('/api/n9e/zabbix-host-search', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || { list: [], total: 0, truncated: false });
}

/** 数据源连通性探针：同时返回上游 Zabbix 版本，用于工具栏状态提示 */
export function getZabbixVersion(data: { cate: DatasourceCateEnum; datasource_id: number }): Promise<string> {
  return request('/api/n9e/zabbix-version', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || '');
}

export function getZabbixHostGroups(data: { cate: DatasourceCateEnum; datasource_id: number }): Promise<ZabbixHostGroup[]> {
  return request('/api/n9e/zabbix-hostgroups', {
    method: RequestMethod.Post,
    data,
  }).then((res) => res.dat || []);
}

/**
 * 主机问题列表：复用 logs-query 通道（query_type=problem，后端 problem.get）。
 * from/to 为 unix 秒；problem.get 天然只返回活动（未恢复）问题。
 */
export function queryZabbixProblems(data: {
  datasource_id: number;
  hostid: string;
  severities?: string[];
  start: number;
  end: number;
  limit?: number;
}): Promise<{ list: ZabbixProblemRow[]; total: number }> {
  return request('/api/n9e/logs-query', {
    method: RequestMethod.Post,
    data: {
      cate: DatasourceCateEnum.zabbix,
      datasource_id: data.datasource_id,
      query: [
        {
          ref: 'A',
          query_type: 'problem',
          hostids: [data.hostid],
          severities: data.severities || [],
          from: data.start,
          to: data.end,
          limit: data.limit || 200,
        },
      ],
    },
    silence: true,
  }).then((res) => {
    const dat = res.dat;
    if (Array.isArray(dat)) {
      return { list: dat as ZabbixProblemRow[], total: dat.length };
    }
    return { list: (dat && dat.list) || [], total: (dat && dat.total) || 0 };
  });
}

/**
 * 最新数据：POST /zabbix-latest-data
 *
 * 返回该主机全部类型的监控项（含文本/日志），带最新值、上一值与变化量。
 * item.get 无 offset 参数，后端拉取后内存分页。
 */
export function getZabbixLatestData(
  data: {
    cate: DatasourceCateEnum;
    datasource_id: number;
    hostid: string;
    search?: string;
    value_types?: string[];
    status?: string;
    state?: string;
    offset?: number;
    limit?: number;
  },
): Promise<ZabbixLatestDataResult> {
  return request('/api/n9e/zabbix-latest-data', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || { list: [], total: 0, truncated: false });
}

/**
 * 指标趋势数据：复用通用 ds-query 通道（cate=zabbix → QueryData）。
 * start/end 为 unix 秒（后端 epoch 量级嗅探兼容毫秒）。
 * 窗口 > 3 天时后端自动切换 trend.get 小时聚合。
 */
export function queryZabbixChartData(data: {
  datasource_id: number;
  itemids: string[];
  start: number;
  end: number;
}): Promise<ZabbixSeries[]> {
  return request('/api/n9e/ds-query', {
    method: RequestMethod.Post,
    data: {
      cate: DatasourceCateEnum.zabbix,
      datasource_id: data.datasource_id,
      query: [
        {
          ref: 'A',
          itemids: data.itemids,
          start: data.start,
          end: data.end,
        },
      ],
    },
    silence: true,
  }).then((res) => res.dat || []);
}
