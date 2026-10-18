import { NAME_SPACE } from '../constants';

export const DEFAULT_LOGS_PAGE_SIZE = 30;
export const LOGS_OPTIONS_CACHE_KEY = `ng-${NAME_SPACE}-explorerng-logs-options`;
export const LOGS_TABLE_COLUMNS_WIDTH_CACHE_KEY = `ng-${NAME_SPACE}-explorerng-logs-table-columns-width`;
export const DEFAULT_TIME_FIELD = '_time';
export const DEFAULT_LIMIT = 100;

/** Zabbix severity levels (trigger severity 0-5) */
export const SEVERITY_OPTIONS = [
  { value: '0', label: 'Not classified' },
  { value: '1', label: 'Information' },
  { value: '2', label: 'Warning' },
  { value: '3', label: 'Average' },
  { value: '4', label: 'High' },
  { value: '5', label: 'Disaster' },
];

/** Internal keys added by the frontend for LogsViewer; stripped on export. */
export const INTERNAL_FIELDS = ['__n9e_id_n9e__', '__n9e_raw_n9e__', '___id___', '___raw___'];
