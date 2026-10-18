import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, Space, Tag, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import _ from 'lodash';

import { CommonStateContext } from '@/App';
import { DatasourceCateEnum } from '@/utils/constant';
import { HOST_STATUS_MAP } from '../constants';
import { getZabbixHostGroups, getZabbixVersion } from '../services';
import type { ZabbixHostGroup } from '../services';

export interface ZabbixDatasourceOption {
  id: number;
  name: string;
}

export interface HostFilterValues {
  name: string;
  ip: string;
  status?: string;
  groupids: string[];
}

/**
 * 主机筛选栏：数据源 / 主机名称 / IP 地址 / 状态 / 主机群组。
 *
 * 交互约定（对齐 Zabbix「监测 > 主机」的筛选习惯）：
 *   - 名称与 IP 是子串匹配，输入即生效（点查询或回车触发）；
 *   - 主机群组只在切换数据源时拉取一次，失败不阻塞筛选（下拉降级为空）；
 *   - 数据源旁展示上游 Zabbix 版本，作为连通性状态提示。
 */
export default function QueryBar({
  datasources,
  datasourceId,
  onDatasourceChange,
  values,
  onValuesChange,
  onSearch,
  onReset,
  searchLoading,
}: {
  datasources: ZabbixDatasourceOption[];
  datasourceId: number | undefined;
  onDatasourceChange: (id: number) => void;
  values: HostFilterValues;
  onValuesChange: (values: HostFilterValues) => void;
  onSearch: () => void;
  onReset: () => void;
  searchLoading: boolean;
}) {
  const [groups, setGroups] = useState<ZabbixHostGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [version, setVersion] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [form] = Form.useForm<HostFilterValues>();

  // 外部 values（重置）同步进表单
  useEffect(() => {
    form.setFieldsValue(values);
  }, [values, form]);

  // 切数据源拉主机组 + 探测版本
  useEffect(() => {
    if (!datasourceId) {
      setGroups([]);
      setVersion('');
      return;
    }
    let cancelled = false;
    setGroupsLoading(true);
    getZabbixHostGroups({ cate: DatasourceCateEnum.zabbix, datasource_id: datasourceId })
      .then((rows) => {
        if (!cancelled) setGroups(rows);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    getZabbixVersion({ cate: DatasourceCateEnum.zabbix, datasource_id: datasourceId })
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        if (!cancelled) setVersion('');
      });
    return () => {
      cancelled = true;
    };
  }, [datasourceId, reloadKey]);

  const emit = (changed: Partial<HostFilterValues> = {}) => {
    const next = { ...form.getFieldsValue(), ...changed };
    onValuesChange(next);
  };

  const groupOptions = useMemo(
    () =>
      _.map(groups, (g) => ({
        label: g.name,
        value: g.groupid,
      })),
    [groups],
  );

  return (
    <Form
      form={form}
      layout='vertical'
      initialValues={values}
      onFinish={() => onSearch()}
      style={{ rowGap: 0 }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <Form.Item label='数据源' style={{ marginBottom: 0, minWidth: 200 }}>
          <Select
            style={{ width: 200 }}
            value={datasourceId}
            onChange={onDatasourceChange}
            options={_.map(datasources, (ds) => ({ label: ds.name, value: ds.id }))}
            showSearch
            optionFilterProp='label'
            data-datasourceId={datasourceId}
          />
        </Form.Item>

        <Form.Item name='name' label='主机名称' style={{ marginBottom: 0, width: 200 }}>
          <Input
            allowClear
            placeholder='显示名或技术名'
            onChange={(e) => emit({ name: e.target.value })}
            onPressEnter={() => onSearch()}
          />
        </Form.Item>

        <Form.Item name='ip' label='IP 地址' style={{ marginBottom: 0, width: 180 }}>
          <Input
            allowClear
            placeholder='接口 IP / DNS 子串'
            onChange={(e) => emit({ ip: e.target.value })}
            onPressEnter={() => onSearch()}
          />
        </Form.Item>

        <Form.Item name='status' label='状态' style={{ marginBottom: 0, width: 140 }}>
          <Select
            allowClear
            placeholder='全部'
            options={_.map(HOST_STATUS_MAP, (label, value) => ({ label, value }))}
            onChange={(v) => emit({ status: v })}
          />
        </Form.Item>

        <Form.Item name='groupids' label='主机群组' style={{ marginBottom: 0, minWidth: 240 }}>
          <Select
            mode='multiple'
            allowClear
            maxTagCount='responsive'
            placeholder={groupsLoading ? '加载主机组…' : '全部群组'}
            loading={groupsLoading}
            options={groupOptions}
            optionFilterProp='label'
            style={{ minWidth: 240 }}
            onChange={(v) => emit({ groupids: v })}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space size={8}>
            <Button type='primary' icon={<SearchOutlined />} htmlType='submit' loading={searchLoading}>
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                onReset();
              }}
            >
              重置
            </Button>
            <Tooltip title='刷新主机组与版本信息'>
              <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)} />
            </Tooltip>
          </Space>
        </Form.Item>

        {version && (
          <Form.Item label=' ' style={{ marginBottom: 0 }}>
            <Tooltip title='Zabbix 数据源连通正常'>
              <Tag color='green'>Zabbix {version}</Tag>
            </Tooltip>
          </Form.Item>
        )}
      </div>
    </Form>
  );
}
