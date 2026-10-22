export type MCPTransport = 'sse' | 'streamable-http';

export interface Item {
  id: number;
  name: string;
  description: string;
  transport: MCPTransport;
  url: string;
  // 列表与详情接口均返回遮蔽取值的视图（键保留、值替换为 ********）；
  // 保存时掩码值原样提交，后端会保留库中真实值（mergeMaskedHeaders）。
  headers?: Record<string, string>;
  timeout: number;
  enabled: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export type FormValues = {
  name: string;
  description: string;
  transport: MCPTransport;
  url: string;
  headers?: { key: string; value: string }[];
  timeout?: number;
  enabled: boolean;
};
