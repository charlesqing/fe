import request from '@/utils/request';
import { RequestMethod } from '@/store/common';

import { Item, FormValues } from './types';

export type { Item, FormValues };

export const getList = function (): Promise<Item[]> {
  return request('/api/n9e/mcp-servers', {
    method: RequestMethod.Get,
  }).then((res) => res.dat ?? []);
};

export const getItem = function (id: number): Promise<Item> {
  return request(`/api/n9e/mcp-server/${id}`, {
    method: RequestMethod.Get,
  }).then((res) => res.dat);
};

export const postItem = function (data: Item) {
  return request('/api/n9e/mcp-servers', {
    method: RequestMethod.Post,
    data,
  }).then((res) => res.dat);
};

// putItem 接受局部字段：列表页开关只提交 { enabled }，避免把遮蔽后的 headers
// 值整体回写（后端 Update 的 Select 白名单天然兼容局部更新）。
export const putItem = function (id: number, data: Partial<Item>) {
  return request(`/api/n9e/mcp-server/${id}`, {
    method: RequestMethod.Put,
    data,
  }).then((res) => res.dat);
};

export const deleteItem = function (id: number) {
  return request(`/api/n9e/mcp-server/${id}`, {
    method: RequestMethod.Delete,
  }).then((res) => res.dat);
};

export interface TestResult {
  ok: boolean;
  error?: string;
  tool_count?: number;
  tools?: string[];
}

export const testConnection = function (data: Item): Promise<TestResult> {
  return request('/api/n9e/mcp-servers/test', {
    method: RequestMethod.Post,
    data,
  }).then((res) => res.dat);
};
