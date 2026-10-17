import { formatTimeFieldValue, toNativeValue, transformLogRow } from './logRow';

describe('OpenObserve ExplorerNG logRow utils', () => {
  describe('toNativeValue', () => {
    it.each([
      ['42', 42],
      ['-7', -7],
      ['0', 0],
      ['1786801681627000', 1786801681627000],
      ['007', '007'], // 前导零视为标识符，不还原
      ['1e3', '1e3'], // 非纯整数字面量，保持字符串
      ['3.14', '3.14'],
      ['9007199254740993', '9007199254740993'], // 超出安全整数范围，保持字符串防精度丢失
      ['abc', 'abc'],
      ['', ''],
      [42, 42],
      [null, null],
      [{ a: 1 }, { a: 1 }],
    ])('converts %p to %p', (input, expected) => {
      expect(toNativeValue(input)).toEqual(expected);
    });
  });

  describe('transformLogRow', () => {
    it('flattens labels/parsed_fields to top level with native values', () => {
      const row = transformLogRow({
        timestamp: 1786801681627,
        __timestamp__: '1786801681627000000',
        line: 'raw line',
        labels: { _timestamp: '1786801681627000', code: '200', took: '1.5', level: 'info' },
        parsed_fields: { extra: 'value' },
      });
      // 拍平后的原始字段在顶层，且数值型字符串已还原
      expect(row._timestamp).toBe(1786801681627000);
      expect(row.code).toBe(200);
      expect(row.level).toBe('info');
      expect(row.extra).toBe('value');
      // 保留归一化包装字段（时间列排序/身份识别用，展示层过滤）
      expect(row.timestamp).toBe(1786801681627);
      expect(row.__timestamp__).toBe('1786801681627000000');
      // JSON Tab 的 raw_key 指向扁平行，与 OpenObserve 原版详情一致
      expect(row.__n9e_raw_n9e__).toEqual({
        _timestamp: 1786801681627000,
        code: 200,
        took: '1.5',
        level: 'info',
        extra: 'value',
      });
      // 不保留内部包装字段的嵌套副本
      expect(row.labels).toBeUndefined();
      expect(row.parsed_fields).toBeUndefined();
      // 不额外注入 line（避免与扁平行的 log/message 字段重复）
      expect(row.line).toBeUndefined();
      expect(row.__n9e_id_n9e__).toMatch(/^log_id_/);
    });

    it('parsed_fields overrides labels on key conflicts', () => {
      const row = transformLogRow({
        labels: { msg: 'from labels' },
        parsed_fields: { msg: 'from parsed' },
      });
      expect(row.msg).toBe('from parsed');
    });

    it('handles empty normalized log', () => {
      const row = transformLogRow({});
      expect(row.timestamp).toBeUndefined();
      expect(row.__n9e_raw_n9e__).toEqual({});
    });
  });

  describe('formatTimeFieldValue', () => {
    it('formats microseconds as MM-DD HH:mm:ss.SSS', () => {
      // 2026-08-15 21:48:01.627 UTC+8 的微秒表示
      expect(formatTimeFieldValue('1786801681627000')).toBe('08-15 21:48:01.627');
      expect(formatTimeFieldValue(1786801681627000)).toBe('08-15 21:48:01.627');
    });

    it('formats nanoseconds by scaling down', () => {
      expect(formatTimeFieldValue('1786801681627000000')).toBe('08-15 21:48:01.627');
    });

    it('formats milliseconds as-is', () => {
      expect(formatTimeFieldValue('1786801681627')).toBe('08-15 21:48:01.627');
    });

    it('formats seconds by scaling up', () => {
      expect(formatTimeFieldValue('1786801681')).toBe('08-15 21:48:01.000');
    });

    it.each([[undefined], [null], ['']])('returns - for %p', (input) => {
      expect(formatTimeFieldValue(input as any)).toBe('-');
    });

    it('returns raw string for non-numeric values', () => {
      expect(formatTimeFieldValue('not-a-time')).toBe('not-a-time');
    });
  });
});
