export interface DataSourceType {
  id: number;
  plugin_id: number;
  name: string;
  description: string;
  status: string;
  plugin_type: string;
  plugin_type_name: string;
  settings: {
    'zabbix.addr': string;
    'zabbix.user': string;
    'zabbix.password': string;
    'zabbix.timeout': number;
    'zabbix.max_query_rows': number;
    'zabbix.basic': {
      'zabbix.basic_user': string;
      'zabbix.basic_password': string;
      'zabbix.is_encrypt': boolean;
    };
    'zabbix.tls': {
      'zabbix.tls.skip_tls_verify': boolean;
    };
    'zabbix.headers': {
      [key: string]: string;
    };
    'zabbix.cluster_name': string;
  };
  created_at: number;
  updated_at: number;
  connectionStatus?: string;
}
