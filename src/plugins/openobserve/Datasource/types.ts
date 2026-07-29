export interface DataSourceType {
  id: number;
  plugin_id: number;
  name: string;
  description: string;
  status: string;
  plugin_type: string;
  plugin_type_name: string;
  settings: {
    'openobserve.addr': string;
    'openobserve.timeout': string;
    'openobserve.basic': {
      'openobserve.is_encrypt': boolean;
      'openobserve.user': string;
      'openobserve.password': string;
    };
    'openobserve.tls': {
      'openobserve.tls.skip_tls_verify': boolean;
    };
    'openobserve.headers': {
      [key: string]: string;
    };
    'openobserve.cluster_name': string;
  };
  created_at: number;
  updated_at: number;
  connectionStatus?: string;
}
