import React from 'react';
import { Form, Row, Col, Input, Select, Switch, InputNumber, Button } from 'antd';
import { FormInstance } from 'antd/es/form';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { SIZE } from '@/utils/constant';

import { NS } from '../constants';
import './style.less';
interface Props {
  form: FormInstance;
  isSystemConfig?: boolean;
}

export default function FormCpt(props: Props) {
  const { t } = useTranslation(NS);
  const { form, isSystemConfig = false } = props;

  return (
    <Form form={form} layout='vertical'>
      <Row gutter={SIZE}>
        <Col flex='auto'>
          <Form.Item label={t('name')} name='name' rules={[{ required: true }]}>
            <Input disabled={isSystemConfig} placeholder={t('form.name_placeholder')} />
          </Form.Item>
        </Col>
        <Col flex='none'>
          <Form.Item label={t('enabled')} name='enabled' valuePropName='checked' initialValue={true}>
            <Switch disabled={isSystemConfig} />
          </Form.Item>
        </Col>
      </Row>
      <div className={isSystemConfig ? 'hidden' : undefined}>
        <Form.Item label={t('description')} name='description'>
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} placeholder={t('form.description_placeholder')} />
        </Form.Item>
        <Row gutter={SIZE}>
          <Col span={12}>
            <Form.Item label={t('transport')} tooltip={t('form.transport_tip')} name='transport' rules={[{ required: true }]} initialValue='streamable-http'>
              <Select
                options={[
                  { label: t('form.transport_map.streamable-http'), value: 'streamable-http' },
                  { label: t('form.transport_map.sse'), value: 'sse' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('form.timeout')} tooltip={t('form.timeout_tip')} name='timeout'>
              <InputNumber style={{ width: '100%' }} min={1} max={300} placeholder={t('form.timeout_placeholder')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label={t('form.url_label')} tooltip={t('form.url_tip')} name='url' rules={[{ required: true }]}>
          <Input placeholder={t('form.url_placeholder')} />
        </Form.Item>
        <Form.Item label={t('form.headers')} tooltip={t('form.headers_tip')} name='headers'>
          <Form.List name='headers'>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={SIZE}>
                    <Col flex='auto'>
                      <Row gutter={SIZE}>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'key']} rules={[{ required: true, message: '' }]}>
                            <Input placeholder={t('form.headers_key')} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item {...restField} name={[name, 'value']} rules={[{ required: true, message: '' }]}>
                            {/* 密码框 + 眼睛图标：凭据类 header 值防截图/肩窥泄露。
                                编辑态后端返回的是掩码值 ********，原样保存即保留原值。 */}
                            <Input.Password placeholder={t('form.headers_value')} autoComplete='new-password' />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Col>
                    <Col flex='none'>
                      <Button type='text' onClick={() => remove(name)} icon={<MinusCircleOutlined />} />
                    </Col>
                  </Row>
                ))}
                <Button className='w-full' type='dashed' onClick={() => add()} icon={<PlusOutlined />}>
                  {t('form.add_header')}
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>
      </div>
    </Form>
  );
}
