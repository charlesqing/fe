import { saveAs } from 'file-saver';

import { buildExportFilename, exportLogsAsCSV, exportLogsAsJSON, exportLogsAsXLSX, stripInternalFields, EXPORT_MAX_ROWS } from './exportLogs';

jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

// node 环境没有 Blob；saveAs 已被 mock，这里只需保证 new Blob(...) 不抛错
(global as any).Blob = class MockBlob {
  constructor(
    public parts: any[],
    public opts: any,
  ) {}
};

describe('OpenObserve ExplorerNG exportLogs utils', () => {
  describe('stripInternalFields', () => {
    it('removes platform internal keys and keeps visible fields', () => {
      const rows = stripInternalFields([
        {
          _timestamp: 1786801681627000,
          code: 200,
          msg: 'hello',
          timestamp: 1786801681627,
          __timestamp__: '1786801681627000000',
          __n9e_id_n9e__: 'log_id_1',
          __n9e_raw_n9e__: { code: 200 },
        },
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual({ _timestamp: 1786801681627000, code: 200, msg: 'hello' });
    });
  });

  describe('buildExportFilename', () => {
    it('builds a timestamped filename per format', () => {
      const now = new Date(2026, 7, 15, 21, 48, 1);
      expect(buildExportFilename('csv', now)).toBe('nightingale_logs_20260815-214801.csv');
      expect(buildExportFilename('xlsx', now)).toBe('nightingale_logs_20260815-214801.xlsx');
      expect(buildExportFilename('json', now)).toBe('nightingale_logs_20260815-214801.json');
    });
  });

  describe('exportLogsAsCSV', () => {
    it('calls saveAs with BOM-prefixed RFC4180 csv', async () => {
      await exportLogsAsCSV([{ a: 1, b: 'x,y' }], 'out.csv');
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob, filename] = (saveAs as jest.Mock).mock.calls[0];
      expect(filename).toBe('out.csv');
      expect(blob.opts.type).toBe('text/csv;charset=utf-8;');
      const csv = blob.parts[0] as string;
      expect(csv.startsWith('\ufeff')).toBe(true);
      expect(csv).toContain('a,b');
      expect(csv).toContain('"x,y"');
    });
  });

  describe('exportLogsAsJSON', () => {
    it('calls saveAs with pretty-printed json', async () => {
      await exportLogsAsJSON([{ level: 'info' }], 'out.json');
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob, filename] = (saveAs as jest.Mock).mock.calls[0];
      expect(filename).toBe('out.json');
      expect(blob.opts.type).toBe('application/json;charset=utf-8;');
      const parsed = JSON.parse((blob.parts[0] as string).replace('\ufeff', ''));
      expect(parsed).toEqual([{ level: 'info' }]);
    });
  });

  describe('exportLogsAsXLSX', () => {
    it('writes a real xlsx workbook and downloads it', async () => {
      await exportLogsAsXLSX([{ level: 'info', code: 200 }], 'out.xlsx');
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob, filename] = (saveAs as jest.Mock).mock.calls[0];
      expect(filename).toBe('out.xlsx');
      expect(blob.opts.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // xlsx 是 zip 容器，魔术字节为 PK\x03\x04；长度应明显大于空文件
      const buffer = Buffer.from(blob.parts[0] as Uint8Array);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
    });
  });

  it('caps a single export at EXPORT_MAX_ROWS', () => {
    expect(EXPORT_MAX_ROWS).toBe(10000);
  });
});
