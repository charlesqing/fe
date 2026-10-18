import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Button, Drawer, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { LineChartOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import _ from 'lodash';

import { CommonStateContext } from '@/App';

import { DEFAULT_ITEM_PAGE_SIZE, ITEM_FILTER_OPTIONS, ITEM_STATE_MAP, ITEM_STATUS_MAP, REFRESH_INTERVAL_OPTIONS, VALUE_TYPE_MAP } from '../constants';
import type { ItemFilterKey } from '../constants';
import { itemFilterToQuery } from '../constants';
import type { ZabbixHostSearchRow, ZabbixLatestDataRow, ZabbixLatestDataResult } from '../services';
import { getZabbixLatestData } from '../services';
import { escapeRegExp, formatDelta, formatLatestValue, formatRelativeTime } from '../utils';

/**
 * 最新数据抽屉：对齐 Zabbix「监测 > 最新数据」的核心列（名称 / 最新值 / 变化 / 检查时间）。
 *
 * 交互约定：
 *   - 关键词本地过滤 + 服务端筛选预设（值类型/状态/采集状态）组合；
 *   - 自动刷新基于 useRef 定时器，抽屉关闭或主机切换时自动清理；
 *   - 只有数值型（value_type 0/3）监控项才提供「图形」入口。
 */
export default function LatestDataDrawer({
  open,
  host,
  datasourceId,
  onClose,
  onOpenChart,
}: {
  open: boolean;
  host: ZabbixHostSearchRow | undefined;
  datasourceId: number | undefined;
  onClose: () => void;
  onOpenChart: (row: ZabbixLatestDataRow) => void;
}) {
  const { darkMode } = useContext(CommonStateContext);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [filterKey, setFilterKey] = useState<ItemFilterKey>('all');
  const [page, setPage] = useState({ current: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
  const [result, setResult] = useState<ZabbixLatestDataResult>({ list: [], total: 0, truncated: false });
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLatest = React.useCallback(() => {
    if (!datasourceId || !host) {
      return;
    }
    setLoading(true);
    getZabbixLatestData({
      cate: 'zabbix' as any,
      datasource_id: datasourceId,
      hostid: host.hostid,
      search: appliedSearch,
      ...itemFilterToQuery(filterKey),
      offset: (page.current - 1) * page.pageSize,
      limit: page.pageSize,
    })
      .then(setResult)
      .catch(() => {
        setResult({ list: [], total: 0, truncated: false });
      })
      .finally(() => setLoading(false));
  }, [datasourceId, host, appliedSearch, filterKey, page]);

  // 打开 / 换主机 / 换筛选 / 翻页时拉取
  useEffect(() => {
    if (open) {
      fetchLatest();
    }
  }, [open, fetchLatest]);

  // 自动刷新定时器
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (open && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(fetchLatest, refreshInterval * 1000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [open, refreshInterval, fetchLatest]);

  // 换主机清空筛选与页码
  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
    setFilterKey('all');
    setPage({ current: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
    setRefreshInterval(0);
  }, [host?.hostid]);

  const highlightName = (text: string) => {
    if (!appliedSearch.trim()) {
      return text;
    }
    const parts = text.split(new RegExp(`(${escapeRegExp(appliedSearch.trim())})`, 'i'));
    return _.map(parts, (part, i) =>
      part.toLowerCase() === appliedSearch.trim().toLowerCase() ? (
        <mark key={i} style={{ background: darkMode ? '#5b3a06' : '#ffe58f', padding: '0 1px' }}>
          {part}
        </mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
  };

  const columns = [
    {
      title: '监控项',
      dataIndex: 'name',
      render: (_: string, row: ZabbixLatestDataRow) => (
        <div style={{ maxWidth: 360 }}>
          <div>{highlightName(row.name)}</div>
          <Typography.Text type='secondary' code style={{ fontSize: 12 }}>
            {row.key_}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '最新值',
      dataIndex: 'lastvalue',
      width: 170,
      render: (_: string, row: ZabbixLatestDataRow) => {
        if (row.state === '1') {
          return (
            <Tooltip title={row.error || '采集不支持'}>
              <Typography.Text type='danger' style={{ fontSize: 12 }}>
                不支持
              </Typography.Text>
            </Tooltip>
          );
        }
        return (
          <Typography.Text strong style={{ fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 13 }}>
            {formatLatestValue(row)}
          </Typography.Text>
        );
      },
    },
    {
      title: '变化',
      dataIndex: 'change',
      width: 150,
      render: (_: number, row: ZabbixLatestDataRow) => {
        const delta = formatDelta(row);
        if (delta.direction === 'none') {
          return <Typography.Text type='secondary'>-</Typography.Text>;
        }
        return (
          <span style={{ color: delta.color, fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 12 }}>{delta.text}</span>
        );
      },
    },
    {
      title: '检查时间',
      dataIndex: 'lastclock',
      width: 130,
      render: (clock: number, row: ZabbixLatestDataRow) => {
        if (!clock) {
          return <Typography.Text type='secondary'>从未</Typography.Text>;
        }
        const exact = new Date(clock * 1000).toLocaleString();
        return (
          <Tooltip title={exact}>
            <span style={{ fontSize: 12 }}>{formatRelativeTime(clock)}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '类型',
      dataIndex: 'value_type',
      width: 110,
      render: (vt: string, row: ZabbixLatestDataRow) => (
        <Space size={4}>
          <Tag style={{ marginRight: 0 }}>{VALUE_TYPE_MAP[vt] || vt}</Tag>
          {row.status === '1' && (
            <Tooltip title='监控项已禁用'>
              <Tag color='default' style={{ marginRight: 0 }}>
                禁用
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_: unknown, row: ZabbixLatestDataRow) =>
        row.chartable ? (
          <Button
            type='link'
            size='small'
            icon={<LineChartOutlined />}
            onClick={() => onOpenChart(row)}
          >
            图形
          </Button>
        ) : (
          <Tooltip title={row.state === '1' ? '采集不支持的监控项无法出图' : '文本 / 日志类监控项不支持趋势图'}>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              不可出图
            </Typography.Text>
          </Tooltip>
        ),
    },
  ];

  return (
    <Drawer
      title={
        host ? (
          <Space size={8} wrap>
            <span>最新数据</span>
            <Typography.Text type='secondary' style={{ fontWeight: 400, fontSize: 12 }}>
              {host.name || host.host}
              {host.ip ? ` · ${host.ip}` : ''}
            </Typography.Text>
          </Space>
        ) : (
          '最新数据'
        )
      }
      placement='right'
      width='72%'
      visible={open}
      onClose={onClose}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Input
            allowClear
            style={{ width: 240 }}
            prefix={<SearchOutlined style={{ color: 'var(--fc-text-color-secondary, #8c8c8c)' }} />}
            placeholder='按名称或 key 过滤'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => {
              setAppliedSearch(search);
              setPage((p) => ({ ...p, current: 1 }));
            }}
          />
          <Select
            style={{ width: 170 }}
            value={filterKey}
            options={ITEM_FILTER_OPTIONS}
            onChange={(v: ItemFilterKey) => {
              setFilterKey(v);
              setPage((p) => ({ ...p, current: 1 }));
            }}
          />
          <Button icon={<SearchOutlined />} onClick={() => { setAppliedSearch(search); setPage((p) => ({ ...p, current: 1 })); }}>
            过滤
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchLatest} loading={loading}>
            刷新
          </Button>
          <Select
            style={{ width: 130 }}
            value={refreshInterval}
            options={REFRESH_INTERVAL_OPTIONS}
            onChange={setRefreshInterval}
          />
        </Space>
      </div>

      {result.truncated && (
        <Alert
          type='warning'
          showIcon
          style={{ marginBottom: 12 }}
          message='该主机监控项较多，仅返回数据源配置上限内的条目；可用过滤条件缩小范围。'
        />
      )}

      <Table<ZabbixLatestDataRow>
        size='small'
        rowKey='itemid'
        loading={loading}
        columns={columns}
        dataSource={result.list}
        pagination={{
          current: page.current,
          pageSize: page.pageSize,
          total: result.total,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (t) => `共 ${t} 个监控项`,
          onChange: (current, pageSize) => setPage({ current, pageSize }),
        }}
        locale={{ emptyText: loading ? '加载中…' : '没有匹配的监控项' }}
      />
    </Drawer>
  );
}
