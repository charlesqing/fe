import React, { useContext } from 'react';
import { Form, Space, Row, Col, Input, Button, Tooltip, Select, Segmented } from 'antd';
import { PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import CardContainer, { CardContainerHeader } from '@/pages/alertRules/FormNG/components/CardContainer';
import FormItemLabel from '@/pages/alertRules/FormNG/components/FormItemLabel';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

import { CommonStateContext } from '@/App';
import InputGroupWithFormItem from '@/components/InputGroupWithFormItem';
import QueryName, { generateQueryName } from '@/components/QueryName';
import DocumentDrawer from '@/components/DocumentDrawer';

import { NAME_SPACE, DEFAULT_QUERY } from '../../constants';
import GraphPreview from './GraphPreview';

interface IProps {
  prefixField?: any;
  fullPrefixName?: string[]; // 完整的前置字段名，用于 getFieldValue 获取指定字段的值
  prefixName?: string[]; // 列表字段名
  disabled?: boolean;
  datasourceValue: number | number[];
}

export default function index({ prefixField = {}, fullPrefixName = [], prefixName = [], disabled, datasourceValue }: IProps) {
  const { t, i18n } = useTranslation(NAME_SPACE);
  const { darkMode } = useContext(CommonStateContext);
  const datasourceID = _.isArray(datasourceValue) ? datasourceValue[0] : datasourceValue;
  const queries = Form.useWatch(['rule_config', 'queries']);
  const form = Form.useFormInstance();

  return (
    <>
      <Form.List
        {...prefixField}
        name={[...prefixName, 'queries']}
        initialValue={[
          {
            ref: 'A',
            query: DEFAULT_QUERY,
            mode: 'sql',
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
                    <Form.Item shouldUpdate noStyle>
                      {({ getFieldValue }) => {
                        const queryObj = getFieldValue([...fullPrefixName, ...prefixName, 'queries', field.name]) || {};
                        const isSql = queryObj.mode ? queryObj.mode === 'sql' : /^\s*select/i.test(queryObj.query || '');
                        return (
                          <Row gutter={8} align='top'>
                            <Col flex='32px'>
                              <Form.Item {...field} name={[field.name, 'ref']} initialValue={generateQueryName(_.map(queries, 'ref'))}>
                                <QueryName existingNames={_.map(queries, 'ref')} />
                              </Form.Item>
                            </Col>
                            <Col flex='auto'>
                              <div className='tdengine-discover-query'>
                                <Space className='mb-1' wrap>
                                  <Segmented
                                    size='small'
                                    value={isSql ? 'sql' : 'simple'}
                                    onChange={(val) => {
                                      const path = [...fullPrefixName, ...prefixName, 'queries', field.name, 'mode'].join('.');
                                      form.setFieldsValue({ [path]: val });
                                    }}
                                    options={[
                                      { label: t('alert.mode_sql'), value: 'sql' },
                                      { label: t('alert.mode_simple'), value: 'simple' },
                                    ]}
                                  />
                                  <Tooltip title={isSql ? t('alert.mode_sql_help') : t('alert.mode_simple_help')}>
                                    <QuestionCircleOutlined />
                                  </Tooltip>
                                </Space>
                                <InputGroupWithFormItem
                                  label={
                                    <Space>
                                      {t('explorer.query')}
                                      <Tooltip title={t('common:click_to_view_doc')}>
                                        <QuestionCircleOutlined
                                          onClick={() => {
                                            DocumentDrawer({
                                              language: i18n.language,
                                              darkMode,
                                              title: t('common:page_help'),
                                              type: 'iframe',
                                              documentPath:
                                                'https://flashcat.cloud/docs/content/flashcat-monitor/nightingale-v9/usage/alert-notify/rules/alert-rules/query-data/openobserve/',
                                            });
                                          }}
                                        />
                                      </Tooltip>
                                    </Space>
                                  }
                                >
                                  <Form.Item {...field} name={[field.name, 'query']}>
                                    <Input.TextArea autoSize={{ minRows: 0 }} placeholder={isSql ? t('alert.query_placeholder_sql') : t('alert.query_placeholder_simple')} />
                                  </Form.Item>
                                </InputGroupWithFormItem>
                                <div className='text-hint text-xs mt-1'>{isSql ? t('alert.mode_sql_help') : t('alert.mode_simple_help')}</div>
                              </div>
                            </Col>
                            <Col>
                              <Form.Item
                                label={t('alert.eval_window')}
                                tooltip={t('alert.eval_window_help')}
                                name={[field.name, 'window']}
                                initialValue={60}
                              >
                                <Select
                                  style={{ width: 130 }}
                                  placeholder='1 分钟 (默认 60s)'
                                  options={[
                                    { label: '1 分钟', value: 60 },
                                    { label: '5 分钟', value: 300 },
                                    { label: '10 分钟', value: 600 },
                                    { label: '15 分钟', value: 900 },
                                    { label: '30 分钟', value: 1800 },
                                    { label: '1 小时', value: 3600 },
                                  ]}
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        );
                      }}
                    </Form.Item>
                  </CardContainerHeader>
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => {
                      const query = getFieldValue([...fullPrefixName, ...prefixName, 'queries', field.name]);

                      return <GraphPreview datasourceValue={datasourceID} query={query} />;
                    }}
                  </Form.Item>
                </CardContainer>
              );
            })}
            <Button
              className='w-full'
              type='dashed'
              onClick={() => {
                add({
                  query: DEFAULT_QUERY,
                  mode: 'sql',
                  interval: 1,
                  interval_unit: 'min',
                  window: 60,
                });
              }}
              icon={<PlusOutlined />}
            >
              {t('datasource:query.title')}
            </Button>
          </div>
        )}
      </Form.List>
    </>
  );
}
