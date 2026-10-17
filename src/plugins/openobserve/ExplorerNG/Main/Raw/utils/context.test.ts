import { getContextTimeRanges, getLogIdentity, mergeContextLogs } from './context';

const ANCHOR_NS = '1786801681627000000'; // 2026-08-15 21:48:01.627 UTC+8

describe('OpenObserve ContextViewer utils', () => {
  describe('getContextTimeRanges', () => {
    it('returns ±2h millisecond windows around the anchor', () => {
      const ranges = getContextTimeRanges(ANCHOR_NS)!;
      expect(ranges).not.toBeNull();
      // 锚点毫秒值
      const anchorMs = 1786801681627;
      // backward 止于 anchor-1ns → 毫秒契约下塌缩为 anchorMs-1
      expect(ranges.backward.end).toBe(anchorMs - 1);
      // forward 起于 anchor+1ns → floor(anchor+1ns) 仍为 anchorMs（去重靠 mergeContextLogs）
      expect(ranges.forward.start).toBe(anchorMs);
      expect(ranges.backward.start).toBe(anchorMs - 2 * 60 * 60 * 1000);
      expect(ranges.forward.end).toBe(anchorMs + 2 * 60 * 60 * 1000);
    });

    it('clamps the backward window at epoch 0 for near-zero anchors', () => {
      const ranges = getContextTimeRanges('1000000000')!; // 1s = 1000ms
      expect(ranges.backward.start).toBe(0);
      expect(ranges.backward.end).toBe(999); // floor((1e9-1)ns → ms)
      expect(ranges.forward.start).toBe(1000);
    });

    it.each([[undefined], [''], ['abc'], ['-1']])('returns null for invalid input %p', (input) => {
      expect(getContextTimeRanges(input as string | undefined)).toBeNull();
    });
  });

  describe('getLogIdentity', () => {
    it('combines timestamp and sorted flat fields, ignoring internal keys', () => {
      const a = { __timestamp__: '100', code: 200, level: 'info', timestamp: 1, __n9e_id_n9e__: 'x', __n9e_raw_n9e__: { code: 200 } };
      const b = { __timestamp__: '100', level: 'info', code: 200, __n9e_id_n9e__: 'y' };
      expect(getLogIdentity(a)).toBe(getLogIdentity(b));
      expect(getLogIdentity(a)).toContain('100|');
      // 字段按 key 排序，保证序列化稳定
      expect(getLogIdentity(a)).toContain('"code":200');
    });

    it('returns empty string for undefined log', () => {
      expect(getLogIdentity(undefined)).toBe('');
    });
  });

  describe('mergeContextLogs', () => {
    const current = { __timestamp__: '200', msg: 'current' };
    const earlier = { __timestamp__: '100', msg: 'earlier' };
    const later = { __timestamp__: '300', msg: 'later' };

    it('merges three segments in ascending time order', () => {
      const merged = mergeContextLogs(current, [earlier], [later]);
      expect(merged.map((item) => item.msg)).toEqual(['earlier', 'current', 'later']);
    });

    it('deduplicates identical rows (same timestamp + same fields)', () => {
      // 完全相同的行（如锚点随前向窗口重新出现）只保留一份
      const merged = mergeContextLogs(current, [earlier], [later, { ...later }]);
      expect(merged).toHaveLength(3);
    });

    it('keeps distinct rows sharing the same timestamp', () => {
      const merged = mergeContextLogs(current, [earlier], [later, { __timestamp__: '300', msg: 'later-dup' }]);
      expect(merged).toHaveLength(4);
    });

    it('keeps the current log even with empty segments', () => {
      const merged = mergeContextLogs(current, [], []);
      expect(merged).toEqual([current]);
    });
  });
});
