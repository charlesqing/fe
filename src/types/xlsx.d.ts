/**
 * SheetJS (xlsx@0.18.5) 的最小类型声明。
 *
 * 只声明本项目用到的 API（utils.json_to_sheet / book_new / book_append_sheet /
 * write）。npm 上的 xlsx 包不自带类型；@types/xlsx 的 DefinitelyTyped 版本
 * (0.0.36) 与 0.18.x 实际 API 有偏差，故用本地声明，避免类型漂移。
 * 该文件被 tsconfig include ("./src") 覆盖，动态 import('xlsx') 自动生效。
 */
declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, any>;
  }
  export interface WorkSheet {
    [cell: string]: any;
  }
  export const utils: {
    json_to_sheet(rows: Record<string, any>[], opts?: { header?: string[] }): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(wb: WorkBook, ws: WorkSheet, name: string): void;
  };
  export function write(wb: WorkBook, opts: { bookType: 'xlsx'; type: 'array' }): ArrayBuffer;
  export function write(wb: WorkBook, opts: { bookType: string; type: string }): any;
}
