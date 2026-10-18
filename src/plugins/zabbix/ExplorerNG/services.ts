import request from '@/utils/request';
import { RequestMethod } from '@/store/common';
import { DatasourceCateEnum } from '@/utils/constant';

import { ZabbixHost, ZabbixHostGroup, ZabbixItem } from './types';

/**
 * Zabbix event query (problem.get / event.get). Unlike log datasources there
 * is no query language: the payload selects event type, hosts, severities.
 */
export function logsQuery(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  query: {
    query_type?: 'problem' | 'event';
    hostids?: string[];
    severities?: string[];
    start: number;
    end: number;
    limit?: number;
    offset?: number;
    ref: string;
    reverse?: boolean;
  }[];
}): Promise<{
  list: Record<string, any>[];
  total: number;
}> {
  return request('/api/n9e/logs-query', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || { list: [], total: 0 });
}

export function getZabbixVersion(data: { cate: DatasourceCateEnum; datasource_id: number }): Promise<string> {
  return request('/api/n9e/zabbix-version', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || '');
}

export function getHostGroups(data: { cate: DatasourceCateEnum; datasource_id: number }): Promise<ZabbixHostGroup[]> {
  return request('/api/n9e/zabbix-hostgroups', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}

export function getHosts(data: { cate: DatasourceCateEnum; datasource_id: number; groupids?: string[] }): Promise<ZabbixHost[]> {
  return request('/api/n9e/zabbix-hosts', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}

export function getItems(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  hostids: string[];
  search?: string;
  limit?: number;
}): Promise<ZabbixItem[]> {
  return request('/api/n9e/zabbix-items', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}
