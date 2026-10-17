import { buildAiAnalyzeContent, toReadableTime } from './aiAnalyze';

describe('toReadableTime', () => {
  it('converts epoch milliseconds', () => {
    expect(toReadableTime(1786801681627)).toContain('2026-08-15T13:48:01.627Z');
  });

  it('converts epoch microseconds passed as string', () => {
    expect(toReadableTime('1786801681627000000')).toContain('2026-08-15T13:48:01.627Z');
  });

  it('converts epoch seconds', () => {
    expect(toReadableTime(1786801681)).toContain('2026-08-15T13:48:01.000Z');
  });

  it('returns undefined for values that are not epoch timestamps', () => {
    expect(toReadableTime(200)).toBeUndefined();
    expect(toReadableTime(500)).toBeUndefined();
    expect(toReadableTime('error')).toBeUndefined();
    expect(toReadableTime('')).toBeUndefined();
    expect(toReadableTime(undefined)).toBeUndefined();
    expect(toReadableTime(null)).toBeUndefined();
    expect(toReadableTime({ a: 1 })).toBeUndefined();
    expect(toReadableTime(Number.NaN)).toBeUndefined();
  });
});

describe('buildAiAnalyzeContent', () => {
  const logItem = {
    _timestamp: '1786801681627000000',
    timestamp: 1786801681627,
    level: 'info',
    status: 200,
    message: 'providing AWS credentials',
  };

  it('injects readable time for epoch fields only', () => {
    const content = buildAiAnalyzeContent(logItem, '_timestamp');
    expect(content).toContain('"_timestamp_readable"');
    expect(content).toContain('"timestamp_readable"');
    expect(content).not.toContain('"status_readable"');
    expect(content).not.toContain('"level_readable"');
  });

  it('keeps the original log fields intact', () => {
    const content = buildAiAnalyzeContent(logItem, '_timestamp');
    expect(content).toContain('"_timestamp": "1786801681627000000"');
    expect(content).toContain('"message": "providing AWS credentials"');
  });

  it('marks the datasource time field in the note block', () => {
    const content = buildAiAnalyzeContent(logItem, '_timestamp');
    expect(content).toContain('【时间字段换算】');
    expect(content).toContain('_timestamp（日志时间字段）');
    expect(content).toContain('2026-08-15T13:48:01.627Z');
  });

  it('appends anti-hallucination and output-structure requirements', () => {
    const content = buildAiAnalyzeContent(logItem, '_timestamp');
    expect(content).toContain('禁止引用日志中不存在的字段或数值');
    expect(content).toContain('问题 / 原因 / 建议');
  });

  it('works without a timeField and without any epoch field', () => {
    expect(buildAiAnalyzeContent({ _timestamp: 1786801681627 })).toContain('_timestamp_readable');
    const plain = buildAiAnalyzeContent({ level: 'info' }, '_timestamp');
    expect(plain).not.toContain('_readable');
    expect(plain).not.toContain('【时间字段换算】');
    expect(plain).toContain('【分析要求】');
  });
});
