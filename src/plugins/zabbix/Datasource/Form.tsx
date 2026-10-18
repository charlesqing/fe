import React, { useRef } from 'react';
import { Form, Card, Input, InputNumber, Space, Switch, Row, Col } from 'antd';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum, SIZE } from '@/utils/constant';
import { scrollToFirstError } from '@/utils';
import Name from '@/pages/datasource/components/items/Name';
import Description from '@/pages/datasource/components/items/Description';
import Footer from '@/pages/datasource/components/items/Footer';
import Headers from '@/pages/datasource/components/itemsNG/Headers';
import Cluster from '@/pages/datasource/components/itemsNG/Cluster';

export default function FormCpt({ action, data, onFinish, submitLoading }: any) {
  const { t } = useTranslation('datasourceManage');
  const [form] = Form.useForm();
  const clusterRef = useRef<any>();
  const cate = DatasourceCateEnum.zabbix;

  return (
    <Form
      form={form}
      layout='vertical'
      onFinish={(values) => {
        onFinish(values, clusterRef.current);
      }}
      onFinishFailed={() => {
        scrollToFirstError();
      }}
      initialValues={data}
      className='settings-source-form'
    >
      <Card title={t(`${action}_title`)}>
        <Name />
        <Form.Item
          label='JSON-RPC Endpoint'
          name={['settings', `${cate}.addr`]}
          tooltip='Zabbix 前端完整 API 地址，例如 https://example.com/zabbix/api_jsonrpc.php'
          rules={[{ required: true }]}
        >
          <Input autoComplete='off' placeholder='https://example.com/zabbix/api_jsonrpc.php' />
        </Form.Item>
        <Row gutter={SIZE * 2}>
          <Col span={12}>
            <Form.Item label='Zabbix 用户' name={['settings', `${cate}.user`]} rules={[{ required: true }]}>
              <Input autoComplete='off' placeholder='Admin' />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label='Zabbix 密码' name={['settings', `${cate}.password`]} rules={[{ required: true }]}>
              <Input.Password autoComplete='new-password' />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={SIZE * 2}>
          <Col span={12}>
            <Form.Item label={t('form.timeout')} name={['settings', `${cate}.timeout`]} initialValue={10000}>
              <InputNumber controls={false} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('form.logs_max_query_rows')} name={['settings', `${cate}.max_query_rows`]} initialValue={1000}>
              <InputNumber controls={false} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <div className='page-title'>{t('form.auth')}</div>
        <Row gutter={SIZE * 2}>
          <Col span={12}>
            <Form.Item
              label={t('form.username')}
              name={['settings', `${cate}.basic`, `${cate}.basic_user`]}
              tooltip='仅当 Zabbix 前置了 nginx 等反向代理且开启了 Basic Auth 时填写'
            >
              <Input autoComplete='off' />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t('form.password')} name={['settings', `${cate}.basic`, `${cate}.basic_password`]}>
              <Input.Password autoComplete='new-password' />
            </Form.Item>
          </Col>
        </Row>
        <Space className='mb-2'>
          <span>{t('form.skip_tls_verify')}</span>
          <Form.Item name={['settings', `${cate}.tls`, `${cate}.tls.skip_tls_verify`]} valuePropName='checked' noStyle>
            <Switch size='small' />
          </Form.Item>
        </Space>
        <Headers cate={cate} />
        <div className='page-title' style={{ marginTop: 0 }}>
          {t('form.other')}
        </div>
        <Cluster cate={cate} clusterRef={clusterRef} />
        <Description />
      </Card>
      <Footer id={data?.id} submitLoading={submitLoading} />
    </Form>
  );
}
