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

export const putItem = function (id: number, data: Item) {
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
