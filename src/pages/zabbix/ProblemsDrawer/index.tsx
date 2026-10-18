import React, { useContext, useEffect, useRef, useState } from 'react';
import { Button, Drawer, Empty, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import TimeRangePicker from '@/components/TimeRangePicker';
import type { IRawTimeRange } from '@/components/TimeRangePicker';
import { timeRangeUnix } from '@/components/TimeRangePicker/utils';
import { CommonStateContext } from '@/App';

import { ACK_STATUS_MAP, DEFAULT_PROBLEM_TIME_RANGE, REFRESH_INTERVAL_OPTIONS, SEVERITY_MAP } from '../constants';
import type { ZabbixHostSearchRow, ZabbixProblemRow } from '../services';
import { queryZabbixProblems } from '../services';
import { formatDuration, hostDisplayName } from '../utils';

/** 行内 tag_<tag> 动态字段提取为标签对 */
function extractTags(row: ZabbixProblemRow): { tag: string; value: string }[] {
  return Object.keys(row)
    .filter((k) => k.startsWith('tag_') && row[k])
    .map((k) => ({ tag: k.slice(4), value: row[k] as string }));
}

/**
 * 主机问题列表抽屉：对齐 Zabbix「监测 > 问题」的列语义
 * （时间 / 严重级 / 问题名+运行数据 / 确认状态 / 持续时长 / 标签）。
 * 数据走 logs-query (query_type=problem)，problem.get 天然只返回活动问题。
 */
export default function ProblemsDrawer({
  open,
  host,
  datasourceId,
  onClose,
}: {
  open: boolean;
  host: ZabbixHostSearchRow | undefined;
  datasourceId: number | undefined;
  onClose: () => void;
}) {
  const { darkMode } = useContext(CommonStateContext);
  const [timeRange, setTimeRange] = useState<IRawTimeRange>(DEFAULT_PROBLEM_TIME_RANGE as IRawTimeRange);
  const [severities, setSeverities] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ZabbixProblemRow[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = (range: IRawTimeRange, silent = false) => {
    if (!datasourceId || !host) {
      return;
    }
    const { start, end } = timeRangeUnix(range);
    if (!silent) {
      setLoading(true);
    }
    queryZabbixProblems({ datasource_id: datasourceId, hostid: host.hostid, severities, start, end })
      .then((res) => setRows(res.list))
      .catch(() => setRows([]))
      .finally(() => {
        setLoading(false);
        setLoadedOnce(true);
      });
  };

  // 打开 / 主机切换 / 严重级变化时拉取
  useEffect(() => {
    if (open && host) {
      fetchData(timeRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, host?.hostid, datasourceId, severities]);

  // 自动刷新
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (open && autoRefresh > 0 && host) {
      timerRef.current = setInterval(() => fetchData(timeRange, true), autoRefresh * 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoRefresh, host?.hostid, timeRange]);

  const drawerTitle = host ? (
    <Space size={8} wrap>
      <span>问题</span>
      <Typography.Text type='secondary' style={{ fontWeight: 400, fontSize: 12 }}>
        {hostDisplayName(host)}
        {host.ip ? ` · ${host.ip}` : ''}
      </Typography.Text>
    </Space>
  ) : (
    '问题'
  );

  const columns = [
    {
      title: '时间',
      dataIndex: 'clock',
      width: 150,
      render: (clock: string) => {
        const sec = Number(clock);
        if (!sec) {
          return '-';
        }
        const d = new Date(sec * 1000);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      },
    },
    {
      title: '严重级',
      dataIndex: 'severity',
      width: 100,
      render: (severity: string) => {
        const meta = SEVERITY_MAP[severity] || SEVERITY_MAP['0'];
        return <Tag style={{ marginRight: 0, color: meta.color, borderColor: meta.color }}>{meta.label}</Tag>;
      },
    },
    {
      title: '问题',
      dataIndex: 'name',
      render: (name: string, row: ZabbixProblemRow) => (
        <div>
          <div>{name || '-'}</div>
          {row.opdata && (
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {row.opdata}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: '确认',
      dataIndex: 'acknowledged',
      width: 90,
      align: 'center' as const,
      render: (ack: string) => (ack === '1' ? <Tag color='green' style={{ marginRight: 0 }}>已确认</Tag> : <Tag color='orange' style={{ marginRight: 0 }}>未确认</Tag>),
    },
    {
      title: '持续时长',
      dataIndex: 'clock',
      key: 'duration',
      width: 120,
      render: (clock: string) => formatDuration(Number(clock)),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      render: (_: unknown, row: ZabbixProblemRow) => {
        const tags = extractTags(row);
        if (tags.length === 0) {
          return <Typography.Text type='secondary'>-</Typography.Text>;
        }
        return (
          <Space size={4} wrap>
            {tags.map((t) => (
              <Tag key={`${t.tag}:${t.value}`} style={{ marginRight: 0 }}>
                {t.tag}: {t.value}
              </Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <Drawer
      title={drawerTitle}
      placement='right'
      width='72%'
      visible={open}
      onClose={onClose}
      destroyOnClose
    >
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Space size={8} wrap>
          <Select
            mode='multiple'
            allowClear
            placeholder='按严重级筛选'
            style={{ minWidth: 220 }}
            value={severities}
            onChange={setSeverities}
            options={Object.keys(SEVERITY_MAP).map((k) => ({ label: SEVERITY_MAP[k].label, value: k }))}
          />
          <Typography.Text type='secondary' style={{ fontSize: 12 }}>
            共 {rows.length} 个活动问题
          </Typography.Text>
        </Space>
        <Space size={8} wrap>
          <Select
            value={autoRefresh}
            onChange={setAutoRefresh}
            style={{ width: 130 }}
            options={REFRESH_INTERVAL_OPTIONS}
          />
          <Tooltip title='刷新问题列表'>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(timeRange)} />
          </Tooltip>
          <TimeRangePicker
            value={timeRange}
            dateFormat='YYYY-MM-DD HH:mm:ss'
            onChange={(range) => {
              setTimeRange(range);
              fetchData(range);
            }}
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        {rows.length === 0 && loadedOnce ? (
          <div style={{ padding: '48px 0' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  该时间窗内没有活动问题
                  <Typography.Text type='secondary' style={{ display: 'block', fontSize: 12 }}>
                    触发器当前均处于 OK 状态（problem.get 只返回未恢复的问题）
                  </Typography.Text>
                </span>
              }
            />
          </div>
        ) : (
          <Table<ZabbixProblemRow>
            size='small'
            rowKey='eventid'
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={false}
            rowClassName={(row) =>
              darkMode ? '' : Number(row.severity) >= 4 ? 'zabbix-problem-row-high' : ''
            }
            locale={{ emptyText: '没有数据' }}
          />
        )}
      </Spin>
    </Drawer>
  );
}
