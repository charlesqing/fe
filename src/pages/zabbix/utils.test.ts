import { formatDelta, formatDuration, formatLatestValue, formatNumber, formatRelativeTime, hostAddress, hostDisplayName, paginate, pickZabbixTimeIncr, seriesStats, seriesToUplotData, seriesLabel, zabbixTimeSplits } from './utils';
import type { ZabbixSeries } from './services';

const NOW_MS = 1780000000000; // 固定"当前时间"，保证相对时间断言稳定

describe('zabbix host page utils', () => {
  describe('paginate', () => {
    const rows = Array.from({ length: 23 }, (_, i) => i + 1);

    it('returns the first page', () => {
      const { list, total } = paginate(rows, 1, 10);
      expect(list).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(total).toBe(23);
    });

    it('returns the partial last page', () => {
      const { list, total } = paginate(rows, 3, 10);
      expect(list).toEqual([21, 22, 23]);
      expect(total).toBe(23);
    });

    it('returns empty when offset is beyond the end', () => {
      const { list, total } = paginate(rows, 9, 10);
      expect(list).toEqual([]);
      expect(total).toBe(23);
    });

    it('handles an empty input', () => {
      expect(paginate([], 1, 10)).toEqual({ list: [], total: 0 });
    });
  });

  describe('host row helpers', () => {
    it('prefers visible name over technical name', () => {
      expect(hostDisplayName({ name: 'Zabbix server', host: 'zbx01' })).toBe('Zabbix server');
      expect(hostDisplayName({ name: '', host: 'zbx01' })).toBe('zbx01');
      expect(hostDisplayName({ name: '', host: '' })).toBe('-');
    });

    it('formats ip:port address', () => {
      expect(hostAddress({ ip: '10.0.0.1', port: '10050' })).toBe('10.0.0.1:10050');
      expect(hostAddress({ ip: '10.0.0.1', port: '' })).toBe('10.0.0.1');
      expect(hostAddress({ ip: '', port: '10050' })).toBe('-');
    });
  });

  describe('formatNumber', () => {
    it('scales byte units by 1024', () => {
      expect(formatNumber(4778909696, 'B')).toBe('4.45 GB');
      expect(formatNumber(1024, 'B')).toBe('1 KB');
    });

    it('scales rate units by 1000', () => {
      expect(formatNumber(1260, 'bps')).toBe('1.26 Kbps');
    });

    it('keeps non-byte units raw with trimmed decimals', () => {
      expect(formatNumber(12.5, '%')).toBe('12.5 %');
      expect(formatNumber(3, '')).toBe('3');
    });

    it('returns dash for non-finite', () => {
      expect(formatNumber(NaN)).toBe('-');
      expect(formatNumber(Infinity)).toBe('-');
    });
  });

  describe('formatLatestValue', () => {
    it('returns placeholder for empty values', () => {
      expect(formatLatestValue({ lastvalue: '', lastvalue_display: '', units: '' })).toBe('—');
    });

    it('prefers the value-mapped display text', () => {
      expect(formatLatestValue({ lastvalue: '1', lastvalue_display: 'Up', units: '' })).toBe('Up');
    });

    it('humanises numeric values by unit', () => {
      expect(formatLatestValue({ lastvalue: '4778909696', lastvalue_display: '', units: 'B' })).toBe('4.45 GB');
    });

    it('shows non-numeric raw values as-is', () => {
      expect(formatLatestValue({ lastvalue: 'Unsupported', lastvalue_display: '', units: '' })).toBe('Unsupported');
    });
  });

  describe('formatDelta', () => {
    it('returns dash when change is missing', () => {
      expect(formatDelta({ change: null, change_pct: null, units: '' }).direction).toBe('none');
    });

    it('returns 0 for unchanged values', () => {
      expect(formatDelta({ change: 0, change_pct: 0, units: '' })).toMatchObject({ text: '0', direction: 'flat' });
    });

    it('marks increase as warm color and decrease as cool color', () => {
      const up = formatDelta({ change: 5, change_pct: 12.5, units: '%' });
      expect(up.direction).toBe('up');
      expect(up.text).toBe('▲ 5 % (12.50%)');
      const down = formatDelta({ change: -2, change_pct: -8, units: '%' });
      expect(down.direction).toBe('down');
      expect(down.color).not.toBe(up.color);
    });
  });

  describe('formatRelativeTime', () => {
    it('returns never for missing clock', () => {
      expect(formatRelativeTime(0, NOW_MS)).toBe('从未');
    });

    it('returns human readable offsets', () => {
      const nowSec = Math.floor(NOW_MS / 1000);
      expect(formatRelativeTime(nowSec - 10, NOW_MS)).toBe('10 秒前');
      expect(formatRelativeTime(nowSec - 300, NOW_MS)).toBe('5 分钟前');
      expect(formatRelativeTime(nowSec - 7200, NOW_MS)).toBe('2 小时前');
      expect(formatRelativeTime(nowSec - 86400 * 3, NOW_MS)).toBe('3 天前');
    });
  });

  describe('series helpers', () => {
    const series: ZabbixSeries[] = [
      {
        ref: 'A',
        metric: { itemname: 'CPU utilization' },
        values: [
          [1780000000, 10],
          [1780000060, 30],
        ],
      },
    ];

    it('extracts series label from metric', () => {
      expect(seriesLabel(series[0].metric)).toBe('CPU utilization');
      expect(seriesLabel({})).toBe('unknown');
    });

    it('converts to sorted uPlot aligned columns and skips non-finite points', () => {
      const s: ZabbixSeries = {
        ref: 'A',
        metric: {},
        values: [
          [1780000060, 2],
          [1780000000, 1],
          [1780000120, NaN as any],
        ],
      };
      const [xs, ys] = seriesToUplotData(s.values);
      expect(xs).toEqual([1780000000, 1780000060]);
      expect(ys).toEqual([1, 2]);
    });

    it('computes stats across series', () => {
      expect(seriesStats(series)).toEqual({ count: 2, min: 10, max: 30, avg: 20, last: 30 });
      expect(seriesStats([])).toBeNull();
    });
  });

  describe('formatDuration', () => {
    const now = 1_800_000_000;

    it('formats seconds / minutes / hours / days like Zabbix', () => {
      expect(formatDuration(now - 45, now)).toBe('45s');
      expect(formatDuration(now - 125, now)).toBe('2m 5s');
      expect(formatDuration(now - 7260, now)).toBe('2h 1m');
      expect(formatDuration(now - 90061, now)).toBe('1d 1h 1m');
    });

    it('handles invalid clock and future timestamps', () => {
      expect(formatDuration(0, now)).toBe('-');
      expect(formatDuration(now + 100, now)).toBe('0s');
    });
  });

  describe('pickZabbixTimeIncr（对齐 Zabbix 原生刻度间隔）', () => {
    // 期望值均来自 Zabbix 7.0 真机实测（192.168.245.128 原生图形）：
    // 1h→2min、3h→5min、6h→15min、12h→15min、24h→30min
    it('matches Zabbix native intervals for common windows', () => {
      expect(pickZabbixTimeIncr(3600)).toBe(120); // 1h → 2min
      expect(pickZabbixTimeIncr(3 * 3600)).toBe(300); // 3h → 5min
      expect(pickZabbixTimeIncr(6 * 3600)).toBe(900); // 6h → 15min
      expect(pickZabbixTimeIncr(12 * 3600)).toBe(900); // 12h → 15min
      expect(pickZabbixTimeIncr(86400)).toBe(1800); // 24h → 30min
      expect(pickZabbixTimeIncr(7 * 86400)).toBe(6 * 3600); // 7d → 6h
      expect(pickZabbixTimeIncr(30 * 86400)).toBe(86400); // 30d → 1d
    });

    it('falls back to 1 minute for invalid periods', () => {
      expect(pickZabbixTimeIncr(0)).toBe(60);
      expect(pickZabbixTimeIncr(-5)).toBe(60);
      expect(pickZabbixTimeIncr(Number.NaN)).toBe(60);
    });
  });

  describe('zabbixTimeSplits', () => {
    it('produces :00/:15/:30/:45 ticks for a 12h window', () => {
      // 2026-10-18 10:00 ~ 22:00（本地时区），12h 窗口 → 15min 刻度
      const start = new Date(2026, 9, 18, 10, 0, 0).getTime() / 1000;
      const end = new Date(2026, 9, 18, 22, 0, 0).getTime() / 1000;
      const splits = zabbixTimeSplits(start, end);
      // 10:00 与 22:00 两个端点都含刻度：48 个间隔 + 1
      expect(splits.length).toBe(49);
      // 首个刻度对齐到 :00/:15/:30/:45 的分钟边界
      expect(new Date(splits[0] * 1000).getMinutes() % 15).toBe(0);
      // 相邻刻度间隔 900s
      expect(splits[1] - splits[0]).toBe(900);
      expect(splits[splits.length - 1]).toBeLessThanOrEqual(end);
    });

    it('aligns >=3h increments to local midnight', () => {
      // 2026-10-18 06:00 ~ 次日 06:00（24h 窗口 → 30min 刻度，分钟对齐）
      const start = new Date(2026, 9, 18, 6, 0, 0).getTime() / 1000;
      const end = new Date(2026, 9, 19, 6, 0, 0).getTime() / 1000;
      const splits = zabbixTimeSplits(start, end);
      expect(splits[1] - splits[0]).toBe(1800);
      // 所有刻度都落在分钟边界上
      splits.forEach((t) => {
        expect(new Date(t * 1000).getSeconds()).toBe(0);
      });
    });

    it('returns empty for inverted or empty windows', () => {
      expect(zabbixTimeSplits(100, 100)).toEqual([]);
      expect(zabbixTimeSplits(200, 100)).toEqual([]);
    });
  });
});
