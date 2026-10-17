import _ from 'lodash';

import request from '@/utils/request';
import { RequestMethod } from '@/store/common';
import { DatasourceCateEnum } from '@/utils/constant';

import { DataResp, FieldNameSuggestion, FieldValueSuggestion, HistogramValue } from './types';
import { filterOutBuilderSuggestionBlockedFields } from './utils/filteredFields';

export function logsQuery(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  query: {
    query: string;
    start: number;
    end: number;
    limit?: number;
    offset?: number;
    ref: string;
    reverse?: boolean;
    org?: string;
    stream?: string;
    /** 跳过总数统计（上下文浏览等场景只要数据不要 count） */
    skip_count?: boolean;
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

export function dsQuery(data: { cate: DatasourceCateEnum; datasource_id: number; query: Record<string, any>[] }): Promise<DataResp[]> {
  return request('/api/n9e/ds-query', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}

export function getFieldNames(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  query: string;
  start: number;
  end: number;
  filter?: string;
  limit?: number;
  org?: string;
  stream?: string;
}): Promise<FieldNameSuggestion[]> {
  return request('/api/n9e/openobserve-label-names', {
    method: RequestMethod.Post,
    data: {
      ...data,
      scope: 'field',
    },
    silence: true,
  }).then((res) => filterOutBuilderSuggestionBlockedFields(_.sortBy(res.dat || [], 'field')));
}

export function getFieldValues(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  query: string;
  start: number;
  end: number;
  field: string;
  filter?: string;
  limit?: number;
  org?: string;
  stream?: string;
}): Promise<FieldValueSuggestion[]> {
  return request('/api/n9e/openobserve-label-values', {
    method: RequestMethod.Post,
    data: {
      ...data,
      scope: 'field',
    },
    silence: true,
  }).then((res) => res.dat || []);
}

export function getHistogram(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  query: {
    query: string;
    start: number;
    end: number;
    step?: string;
    group_by?: string;
    org?: string;
    stream?: string;
  }[];
}): Promise<HistogramValue[]> {
  return request('/api/n9e/openobserve-histogram', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}

export function getOrgs(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
}): Promise<string[]> {
  return request('/api/n9e/openobserve-orgs', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}

export function getStreams(data: {
  cate: DatasourceCateEnum;
  datasource_id: number;
  org: string;
}): Promise<string[]> {
  return request('/api/n9e/openobserve-streams', {
    method: RequestMethod.Post,
    data,
    silence: true,
  }).then((res) => res.dat || []);
}
