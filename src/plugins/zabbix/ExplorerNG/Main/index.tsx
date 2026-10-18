import React, { useContext, useEffect, useState } from 'react';
import { Badge, Button, Col, Form, Row, Segmented, Select, Space, InputNumber } from 'antd';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { useRequest } from 'ahooks';

import { CommonStateContext } from '@/App';
import { SIZE } from '@/utils/constant';
import TimeRangePicker from '@/components/TimeRangePicker';
import { NAME_SPACE as logExplorerNS } from '@/pages/logExplorer/constants';
import { Field } from '@/pages/logExplorer/types';

import { NAME_SPACE } from '../../constants';
import { DEFAULT_LIMIT, DEFAULT_TIME_FIELD, SEVERITY_OPTIONS } from '../constants';
import { getHosts } from '../services';
import Raw from './Raw';

interface Props {
  tabKey: string;
  indexData: Field[];
  executeLoading: boolean;
  setExecuteLoading: (loading: boolean) => void;
  executeQuery: () => void;
}

export default function Main(props: Props) {
  const { t } = useTranslation(NAME_SPACE);
  const { logsDefaultRange } = useContext(CommonStateContext);
  const { tabKey, indexData, executeLoading, setExecuteLoading, executeQuery } = props;
  const form = Form.useFormInstance();
  const refreshFlag = Form.useWatch('refreshFlag');
  const datasourceValue = Form.useWatch('datasourceValue');
  const queryValues = Form.useWatch('query');
  const queryType = queryValues?.query_type || 'problem';

  const {
    data: hostsData,
    loading: hostsLoading,
  } = useRequest(() => getHosts({ cate: 'zabbix', datasource_id: datasourceValue }), {
    ready: !!datasourceValue,
    refreshDeps: [datasourceValue],
  });
  const hosts = hostsData || [];

  useEffect(() => {
    setExecuteLoading(false);
  }, [queryType]);

  const tableSelector = {
    antd: `.zabbix-explorer-container-${tabKey} .n9e-event-logs-table .ant-table-body`,
    rgd: `.zabbix-explorer-container-${tabKey} .n9e-event-logs-table`,
  };

  return (
    <div className='flex flex-col flex-1 h-full min-h-0'>
      <div className='flex-shrink-0 relative z-10'>
        <Row gutter={SIZE} wrap={false}>
          <Col flex='none'>
            <Segmented
              value={queryType}
              options={[
                { label: t('query_type.problem'), value: 'problem' },
                { label: t('query_type.event'), value: 'event' },
              ]}
              onChange={(val) => {
                form.setFieldsValue({
                  query: {
                    ...queryValues,
                    query_type: val,
                  },
                  refreshFlag: _.uniqueId('refreshFlag_'),
                });
              }}
            />
          </Col>
          <Col flex='auto' style={{ minWidth: 0 }}>
            <Form.Item name={['query', 'hostids']} noStyle>
              <Select
                mode='multiple'
                allowClear
                showSearch
                loading={hostsLoading}
                maxTagCount='responsive'
                placeholder={t('form.hosts_placeholder')}
                optionFilterProp='children'
                options={_.map(hosts, (h) => ({
                  value: h.hostid,
                  label: h.name || h.host,
                }))}
              />
            </Form.Item>
          </Col>
          <Col flex='none' style={{ width: 220 }}>
            <Form.Item name={['query', 'severities']} noStyle>
              <Select
                mode='multiple'
                allowClear
                maxTagCount='responsive'
                placeholder={t('form.severities_placeholder')}
                options={SEVERITY_OPTIONS.map((s) => ({ ...s, label: t(`severity.${s.value}`) }))}
              />
            </Form.Item>
          </Col>
          <Col flex='none' style={{ width: 110 }}>
            <Form.Item name={['query', 'limit']} noStyle initialValue={DEFAULT_LIMIT}>
              <InputNumber controls={false} min={1} max={10000} style={{ width: '100%' }} placeholder={t('form.limit')} />
            </Form.Item>
          </Col>
          <Col flex='none'>
            <Form.Item name={['query', 'range']} initialValue={logsDefaultRange} noStyle>
              <TimeRangePicker
                onChange={() => {
                  form.setFieldsValue({
                    refreshFlag: _.uniqueId('refreshFlag_'),
                  });
                }}
                showMillisecond
              />
            </Form.Item>
          </Col>
          <Col flex='none'>
            <Badge dot={false}>
              <Button
                type='primary'
                loading={executeLoading}
                onClick={() => {
                  form.setFieldsValue({
                    refreshFlag: _.uniqueId('refreshFlag_'),
                  });
                }}
              >
                {t(`${logExplorerNS}:execute`)}
              </Button>
            </Badge>
          </Col>
        </Row>
      </div>
      <div className='min-h-0 flex-1 flex flex-col'>
        <Form.Item name={['query', 'query_type']} initialValue='problem' hidden>
          <div />
        </Form.Item>
        <Raw
          tableSelector={tableSelector}
          indexData={indexData}
          setExecuteLoading={setExecuteLoading}
          timeField={DEFAULT_TIME_FIELD}
        />
      </div>
    </div>
  );
}
