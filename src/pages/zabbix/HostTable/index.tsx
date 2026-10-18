import React from 'react';
import { Badge, Button, Space, Table, Tag, Tooltip, Typography } from 'antd';
import { DatabaseOutlined, ProfileOutlined, WarningOutlined } from '@ant-design/icons';

import { AVAILABILITY_MAP, HOST_STATUS_MAP, IFACE_TYPE_MAP } from '../constants';
import type { ZabbixHostSearchRow } from '../services';
import { hostAddress, hostDisplayName } from '../utils';

/**
 * 主机列表：对齐 Zabbix「监测 > 主机」的列语义（名称 / 接口 / 群组 / 状态 / 问题）。
 *
 * 行为约定：
 *   - 点击行内任意处（除操作列）即选中该主机并打开最新数据抽屉；
 *   - 问题列徽标 / 操作列"问题"按钮 → 打开问题列表抽屉；
 *   - 分页为服务端分页：onPageChange 触发父级重新请求。
 */
export default function HostTable({
  rows,
  total,
  loading,
  current,
  pageSize,
  selectedHostId,
  onSelect,
  onOpenProblems,
  onPageChange,
}: {
  rows: ZabbixHostSearchRow[];
  total: number;
  loading: boolean;
  current: number;
  pageSize: number;
  selectedHostId?: string;
  onSelect: (host: ZabbixHostSearchRow) => void;
  onOpenProblems: (host: ZabbixHostSearchRow) => void;
  onPageChange: (current: number, pageSize: number) => void;
}) {
  const columns = [
    {
      title: '主机',
      dataIndex: 'name',
      width: 260,
      render: (_: string, row: ZabbixHostSearchRow) => (
        <Space size={6}>
          <DatabaseOutlined style={{ color: 'var(--fc-fill-color-4, #8c8c8c)' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{hostDisplayName(row)}</div>
            <Typography.Text type='secondary' style={{ fontSize: 12 }}>
              {row.host}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: '接口',
      dataIndex: 'ip',
      width: 200,
      render: (_: string, row: ZabbixHostSearchRow) => {
        if (!row.ip) {
          return <Typography.Text type='secondary'>无接口</Typography.Text>;
        }
        const availability = AVAILABILITY_MAP[row.available] || AVAILABILITY_MAP['0'];
        return (
          <Space size={6}>
            <Tooltip title={`接口可用性：${availability.label}`}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: availability.color,
                }}
              />
            </Tooltip>
            <Typography.Text code style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {hostAddress(row)}
            </Typography.Text>
            <Tag style={{ marginRight: 0 }}>{IFACE_TYPE_MAP[row.iface_type] || '其他'}</Tag>
          </Space>
        );
      },
    },
    {
      title: '主机组',
      dataIndex: 'groups',
      render: (_: string[], row: ZabbixHostSearchRow) => {
        const groups = row.groups || [];
        if (groups.length === 0) {
          return <Typography.Text type='secondary'>-</Typography.Text>;
        }
        return (
          <Tooltip title={groups.map((g) => g.name).join('、')}>
            <Space size={4} wrap>
              {groups.slice(0, 2).map((g) => (
                <Tag key={g.groupid} style={{ marginRight: 0 }}>
                  {g.name}
                </Tag>
              ))}
              {groups.length > 2 && <Tag style={{ marginRight: 0 }}>+{groups.length - 2}</Tag>}
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) =>
        status === '0' ? <Badge status='success' text='监控中' /> : <Badge status='default' text='未监控' />,
    },
    {
      title: '问题',
      dataIndex: 'problem_count',
      width: 90,
      align: 'center' as const,
      render: (count: number, row: ZabbixHostSearchRow) => {
        if (!count) {
          return <Typography.Text type='secondary'>0</Typography.Text>;
        }
        return (
          <Tooltip title={`${count} 个活动问题，点击查看问题列表`}>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onOpenProblems(row);
              }}
              style={{ cursor: 'pointer', display: 'inline-block', whiteSpace: 'nowrap' }}
            >
              <Badge count={count} color='#f5222d' />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_: unknown, row: ZabbixHostSearchRow) => (
        <Space size={0}>
          <Button
            type='link'
            size='small'
            icon={<ProfileOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(row);
            }}
          >
            最新数据
          </Button>
          <Button
            type='link'
            size='small'
            icon={<WarningOutlined />}
            danger={row.problem_count > 0}
            onClick={(e) => {
              e.stopPropagation();
              onOpenProblems(row);
            }}
          >
            问题
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Table<ZabbixHostSearchRow>
      size='small'
      rowKey='hostid'
      loading={loading}
      columns={columns}
      dataSource={rows}
      rowClassName={(row) => (row.hostid === selectedHostId ? 'zabbix-host-row-selected' : '')}
      onRow={(row) => ({
        onClick: () => onSelect(row),
        style: { cursor: 'pointer' },
      })}
      pagination={{
        current,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (t) => `共 ${t} 台主机`,
        size: 'default',
        onChange: onPageChange,
      }}
      locale={{
        emptyText: loading ? '加载中…' : '没有匹配的主机，试试调整筛选条件',
      }}
    />
  );
}
