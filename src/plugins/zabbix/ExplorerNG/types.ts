export interface ZabbixHostGroup {
  groupid: string;
  name: string;
}

export interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
}

export interface ZabbixItem {
  itemid: string;
  name: string;
  key_: string;
  value_type: string;
  units: string;
  status: string;
  state: string;
  hostid: string;
  hosts?: { hostid: string; host: string; name: string }[];
  lastvalue?: string;
  lastclock?: string;
}

export interface DataResp {
  ref: string;
  metric: Record<string, string>;
  values: [number, number][];
  query: string;
}
