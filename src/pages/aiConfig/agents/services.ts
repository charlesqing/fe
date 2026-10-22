import _ from 'lodash';

import request from '@/utils/request';
import { RequestMethod } from '@/store/common';
import { N9E_PATHNAME } from '@/utils/constant';

import { Item, FormValues } from './types';

export type { Item, FormValues };

export const getList = function (): Promise<Item[]> {
  return request('/api/n9e/ai-agents', {
    method: RequestMethod.Get,
  }).then((res) => res.dat ?? []);
};

export const getItem = function (id: number): Promise<Item> {
  return request(`/api/n9e/ai-agent/${id}`, {
    method: RequestMethod.Get,
  }).then((res) => res.dat);
};

export const postItem = function (data: FormValues) {
  return request('/api/n9e/ai-agents', {
    method: RequestMethod.Post,
    data,
  }).then((res) => res.dat);
};

export const putItem = function (id: number, data: FormValues) {
  return request(`/api/n9e/ai-agent/${id}`, {
    method: RequestMethod.Put,
    data,
  }).then((res) => res.dat);
};

export const deleteItem = function (id: number) {
  return request(`/api/n9e/ai-agent/${id}`, {
    method: RequestMethod.Delete,
  }).then((res) => res.dat);
};

// getMCPServers 走轻量 meta 接口：只回 id/name/enabled，不触达凭据列。
// enabled 用于在 Agent 表单里标注「已禁用」——运行时装配工具源会静默剔除
// 禁用服务器（models.MCPServersByIds 过滤 enabled=true），表单里提前标注
// 避免绑定了还以为生效。
export const getMCPServers = function (): Promise<{ id: number; name: string; enabled: boolean }[]> {
  return request(`/api/${N9E_PATHNAME}/mcp-servers/meta`, {
    method: RequestMethod.Get,
  }).then((res) => res.dat ?? []);
};
