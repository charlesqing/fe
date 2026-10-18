import _ from 'lodash';
import { json2csvAsync } from 'json-2-csv';
import { saveAs } from 'file-saver';

/**
 * Zabbix 事件导出工具（CSV / XLSX / JSON）。
 *
 * Zabbix 事件行本身是扁平的（eventid/name/clock/severity/hostname/tag_*），
 * 导出前仅剥离前端为 LogsViewer 加的管道键（行唯一键 / 原始行副本）。
 */

/** 单次导出上限：超出部分提示截断（防止响应体过大与浏览器内存压力） */
export const EXPORT_MAX_ROWS = 10000;

/** 前端管道键：zabbix 事件数据 + LogsViewer 需要的 id/raw 包装 */
const INTERNAL_KEYS = ['__n9e_id_n9e__', '__n9e_raw_n9e__', '___id___', '___raw___'];

export type ExportFormat = 'csv' | 'xlsx' | 'json';

/** 剥离前端管道键，导出内容与页面展示给用户的字段保持一致 */
export function stripInternalFields(rows: Record<string, any>[]): Record<string, any>[] {
  return _.map(rows, (row) => _.omit(row, INTERNAL_KEYS));
}

function downloadBlob(data: BlobPart, filename: string, mime: string) {
  saveAs(new Blob([data], { type: mime }), filename);
}

export async function exportLogsAsCSV(rows: Record<string, any>[], filename: string): Promise<void> {
  const csv = await json2csvAsync(rows);
  downloadBlob('\ufeff' + csv, filename, 'text/csv;charset=utf-8;');
}

export async function exportLogsAsXLSX(rows: Record<string, any>[], filename: string): Promise<void> {
  const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'events');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(buffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export async function exportLogsAsJSON(rows: Record<string, any>[], filename: string): Promise<void> {
  downloadBlob('\ufeff' + JSON.stringify(rows, null, 2), filename, 'application/json;charset=utf-8;');
}

export async function exportLogs(rows: Record<string, any>[], format: ExportFormat, filename: string): Promise<void> {
  if (format === 'csv') {
    await exportLogsAsCSV(rows, filename);
    return;
  }
  if (format === 'xlsx') {
    await exportLogsAsXLSX(rows, filename);
    return;
  }
  await exportLogsAsJSON(rows, filename);
}

/** 导出文件名：nightingale_zabbix_events_YYYYMMDD-HHmmss.{ext} */
export function buildExportFilename(format: ExportFormat, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `nightingale_zabbix_events_${stamp}.${format}`;
}
