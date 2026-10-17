import _ from 'lodash';
import { json2csvAsync } from 'json-2-csv';
import { saveAs } from 'file-saver';

/**
 * 日志导出工具（CSV / XLSX / JSON）。
 *
 * 背景：开源版日志探索页此前只有 plus 版的 DownloadModal（IS_PLUS 门控），
 * 社区版整个日志展示页面没有任何导出能力。本模块按 openobserve 原版
 * 「Download logs」的语义补齐：按当前查询条件重新拉取（而非只导出当前页），
 * 单次上限 EXPORT_MAX_ROWS 条，超出部分提示截断。
 *
 * 实现要点：
 *   1. CSV 走 json-2-csv（v3 的 json2csvAsync 为 Promise API，内部按 RFC 4180 转义），
 *      拼 '\ufeff' BOM 头保证 Excel 直接打开中文不乱码；
 *   2. XLSX 用 SheetJS，动态 import code-split，避免打进主 bundle；
 *      write 出 ArrayBuffer 后统一走 file-saver 下载（不依赖 XLSX.writeFile 的浏览器分支）；
 *   3. JSON 直接 stringify（保留完整字段与嵌套结构）；
 *   4. 导出前剥离平台内部键（行唯一键 / 原始行副本 / 归一化包装时间戳）。
 */

/** 单次导出上限：超出部分提示截断（防止响应体过大与浏览器内存压力） */
export const EXPORT_MAX_ROWS = 10000;

/** 平台内部键：见 LogsViewer/utils/aiAnalyze.ts 的同名清单（保持一致） */
const INTERNAL_KEYS = ['__n9e_id_n9e__', '__n9e_raw_n9e__', '___id___', '___raw___', '__id__', '__raw__', 'timestamp', '__timestamp__'];

export type ExportFormat = 'csv' | 'xlsx' | 'json';

/** 剥离平台内部键，导出内容与详情页展示给用户的字段保持一致 */
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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'logs');
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

/** 导出文件名：nightingale_logs_YYYYMMDD-HHmmss.{ext} */
export function buildExportFilename(format: ExportFormat, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `nightingale_logs_${stamp}.${format}`;
}
