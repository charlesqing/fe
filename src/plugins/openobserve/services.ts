import request from '@/utils/request';
import { RequestMethod } from '@/store/common';

// 仅保留仍在用的“标准 SQL”实时查询入口。
// 旧的 LogSQL 代理（getHistogram/getLogsQuery → /api/n9e-plus/proxy/.../select/logsql/*）
// 在新版 OpenObserve 后端中不可用，且 Builder 已改为产出标准 SQL，故移除。

export type HitResult = {
  fields: {
    [index: string]: string;
  };
  timestamps: Date[];
  values: number[];
  total: number;
};

export const logQuery = function (data: any) {
  return request('/api/n9e/logs-query', {
    method: RequestMethod.Post,
    data,
  }).then((res) => res.dat);
};
