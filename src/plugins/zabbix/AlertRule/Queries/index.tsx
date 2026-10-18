import React, { useContext, useState } from 'react';
import { Button, Col, Form, Row, Segmented, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { useRequest } from 'ahooks';

import CardContainer, { CardContainerHeader } from '@/pages/alertRules/FormNG/components/CardContainer';
import FormItemLabel from '@/pages/alertRules/FormNG/components/FormItemLabel';
import Triggers from '@/pages/alertRules/FormNG/components/Triggers';
import { generateQueryName } from '@/components/QueryName';

import { NAME_SPACE } from '../../constants';
import { getHosts, getItems } from '../../ExplorerNG/services';

interface IProps {
  prefixField?: any;
  fullPrefixName?: string[];
  prefixName?: string[];
  disabled?: boolean;
  datasourceValue: number | number[];
}

const AGG_OPTIONS = [
  { label: 'raw', value: 'raw' },
  { label: 'avg', value: 'avg' },
  { label: 'max', value: 'max' },
  { label: 'min', value: 'min' },
];

export default function index({ prefixField = {}, fullPrefixName = [], prefixName = [], disabled, datasourceValue }: IProps) {
  const { t } = useTranslation(NAME_SPACE);
  const datasourceID = _.isArray(datasourceValue) ? datasourceValue[0] : datasourceValue;
  const queries = (Form.useWatch(['rule_config', 'queries']) || []) as any[];
  const form = Form.useFormInstance();
  // Hosts picked across all queries; the item options below cover their union.
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);

  const { data: hostsData, loading: hostsLoading } = useRequest(
    () => getHosts({ cate: 'zabbix', datasource_id: datasourceID }),
    {
      ready: !!datasourceID,
    },
  );
  const hosts = hostsData || [];

  const { data: itemsData, loading: itemsLoading } = useRequest(
    () => getItems({ cate: 'zabbix', datasource_id: datasourceID, hostids: selectedHosts, limit: 500 }),
    {
      ready: !!datasourceID && selectedHosts.length > 0,
      refreshDeps: [datasourceID, JSON.stringify(selectedHosts)],
    },
  );
  const items = itemsData || [];

  const onHostsChange = (vals: string[]) => {
    setSelectedHosts(vals || []);
    // Clear itemids of every query: previously picked items may no longer be
    // available for the new host selection.
    const ruleConfig = form.getFieldValue('rule_config') || {};
    form.setFieldsValue({
      rule_config: {
        ...ruleConfig,
        queries: _.map(ruleConfig.queries, (q: any) => ({ ...q, itemids: [] })),
      },
    });
  };

  return (
    <>
      <Form.List
        {...prefixField}
        name={[...prefixName, 'queries']}
        initialValue={[
          {
            ref: 'A',
            itemids: [],
            hostids: [],
            agg: 'raw',
            window: 60,
          },
        ]}
      >
        {(fields, { add, remove }) => (
          <div>
            <FormItemLabel>{t('datasource:query.title')}</FormItemLabel>
            {fields.map((field) => {
              return (
                <CardContainer key={field.key} onClose={fields.length > 1 ? () => remove(field.name) : undefined}>
                  <CardContainerHeader>
                    <Row gutter={8} align='top'>
                      <Col flex='auto'>
                        <Space wrap>
                          <Form.Item {...field} name={[field.name, 'hostids']}>
                            <Select
                              mode='multiple'
                              allowClear
                              showSearch
                              loading={hostsLoading}
                              disabled={disabled}
                              maxTagCount='responsive'
                              style={{ minWidth: 240 }}
                              placeholder={t('rule.hosts_placeholder')}
                              optionFilterProp='children'
                              onChange={onHostsChange}
                              options={_.map(hosts, (h: any) => ({ value: h.hostid, label: h.name || h.host }))}
                            />
                          </Form.Item>
                          <Form.Item {...field} name={[field.name, 'agg']} initialValue='raw'>
                            <Segmented size='small' options={AGG_OPTIONS} />
                          </Form.Item>
                        </Space>
                      </Col>
                    </Row>
                  </CardContainerHeader>
                  <Form.Item
                    {...field}
                    name={[field.name, 'itemids']}
                    rules={[{ required: true, message: t('rule.items_required') }]}
                  >
                    <Select
                      mode='multiple'
                      allowClear
                      showSearch
                      loading={itemsLoading}
                      disabled={disabled || selectedHosts.length === 0}
                      maxTagCount='responsive'
                      placeholder={t('rule.items_placeholder')}
                      optionFilterProp='children'
                      options={_.map(items, (i: any) => ({ value: i.itemid, label: `${i.name}${i.units ? ` (${i.units})` : ''}` }))}
                    />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'window']} hidden initialValue={60}>
                    <div />
                  </Form.Item>
                </CardContainer>
              );
            })}
            <Button
              type='dashed'
              block
              icon={<PlusOutlined />}
              disabled={disabled}
              onClick={() => {
                add({
                  ref: generateQueryName(_.map(queries, 'ref')),
                  itemids: [],
                  hostids: [],
                  agg: 'raw',
                  window: 60,
                });
              }}
            >
              {t('rule.add_query')}
            </Button>
          </div>
        )}
      </Form.List>
      <Form.Item shouldUpdate noStyle>
        {({ getFieldValue }) => {
          const queries = getFieldValue(['rule_config', 'queries']);
          return <Triggers prefixName={['rule_config']} queries={queries} />;
        }}
      </Form.Item>
    </>
  );
}
