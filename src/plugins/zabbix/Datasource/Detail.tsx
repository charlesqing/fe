import React from 'react';
import { Row, Col } from 'antd';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum } from '@/utils/constant';

interface Props {
  data: any;
}

export default function Index(props: Props) {
  const { t } = useTranslation('datasourceManage');
  const { data } = props;
  const cate = DatasourceCateEnum.zabbix;

  return (
    <div>
      <div className='page-title'>JSON-RPC Endpoint</div>
      <div className='flash-cat-block'>
        <Row gutter={16}>
          <Col span={24} className='second-color'>
            {_.get(data, ['settings', `${cate}.addr`], '-')}
          </Col>
        </Row>
      </div>
      <div className='page-title'>{t('form.auth')}</div>
      <div className='flash-cat-block'>
        <Row gutter={16}>
          <Col span={8}>Zabbix {t('form.username')}：</Col>
          <Col span={8}>{t('form.password')}：</Col>
          <Col span={8}>{t('form.skip_tls_verify')}：</Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.user`], '-')}
          </Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.password`]) ? '******' : '-'}
          </Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.tls`, `${cate}.tls.skip_tls_verify`]) ? t('form.yes') : t('form.no')}
          </Col>
        </Row>
      </div>
      <div className='flash-cat-block'>
        <Row gutter={16}>
          <Col span={8}>HTTP Basic {t('form.username')}：</Col>
          <Col span={8}>HTTP Basic {t('form.password')}：</Col>
          <Col span={8}>{t('form.timeout')} (ms)：</Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.basic`, `${cate}.basic_user`], '-')}
          </Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.basic`, `${cate}.basic_password`]) ? '******' : '-'}
          </Col>
          <Col span={8} className='second-color'>
            {_.get(data, ['settings', `${cate}.timeout`], '-')}
          </Col>
        </Row>
      </div>
      {!_.isEmpty(_.get(data, ['settings', `${cate}.headers`])) && (
        <>
          <div className='page-title'>{t('form.headers')}</div>
          <div className='flash-cat-block'>
            <Row gutter={16}>
              {_.map(_.get(data, ['settings', `${cate}.headers`]), (val, key) => {
                return (
                  <Col key={key} span={24}>
                    {key + ' : ' + val}
                  </Col>
                );
              })}
            </Row>
          </div>
        </>
      )}
      <div className='flash-cat-block' style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>{t('form.logs_max_query_rows')}：</Col>
          <Col span={16} className='second-color'>
            {_.get(data, ['settings', `${cate}.max_query_rows`], '-')}
          </Col>
        </Row>
      </div>
    </div>
  );
}
