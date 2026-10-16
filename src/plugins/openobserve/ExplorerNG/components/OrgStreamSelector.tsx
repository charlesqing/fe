import React, { useCallback, useEffect, useState } from 'react';
import { Form, Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum } from '@/utils/constant';

import { NAME_SPACE } from '../../constants';
import { getOrgs, getStreams } from '../services';

// OrgStreamSelector 让用户在 Explorer 里先选「组织 → 数据流」，
// 写入 form 的 query.org / query.stream，所有日志查询都会带上这两个值，
// 行为与 OpenObserve 原生 UI 一致。
export default function OrgStreamSelector() {
  const { t } = useTranslation(NAME_SPACE);
  const form = Form.useFormInstance();
  const datasourceValue = Form.useWatch('datasourceValue', form);
  const org = Form.useWatch(['query', 'org'], form);
  const stream = Form.useWatch(['query', 'stream'], form);
  const [orgs, setOrgs] = useState<string[]>([]);
  const [streams, setStreams] = useState<string[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);

  const fetchStreams = useCallback(
    async (nextOrg: string) => {
      if (!datasourceValue || !nextOrg) {
        setStreams([]);
        return;
      }
      setLoadingStreams(true);
      try {
        const list = await getStreams({
          cate: DatasourceCateEnum.openobserve,
          datasource_id: datasourceValue,
          org: nextOrg,
        });
        setStreams(list);
        const current = form.getFieldValue('query') || {};
        const nextStream = current.stream && list.includes(current.stream) ? current.stream : list[0];
        form.setFieldsValue({ query: { ...current, stream: nextStream } });
      } finally {
        setLoadingStreams(false);
      }
    },
    [datasourceValue],
  );

  const fetchOrgs = useCallback(async () => {
    if (!datasourceValue) return;
    setLoadingOrgs(true);
    try {
      const list = await getOrgs({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue,
      });
      setOrgs(list);
      const current = form.getFieldValue('query') || {};
      const nextOrg = current.org && list.includes(current.org) ? current.org : list[0];
      form.setFieldsValue({ query: { ...current, org: nextOrg } });
      if (nextOrg) {
        fetchStreams(nextOrg);
      } else {
        setStreams([]);
      }
    } finally {
      setLoadingOrgs(false);
    }
  }, [datasourceValue, fetchStreams]);

  useEffect(() => {
    fetchOrgs();
    // 仅当数据源切换时重新拉取组织列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasourceValue]);

  return (
    <Space size={8} wrap className='items-center'>
      <span className='text-hint whitespace-nowrap'>{t('organization')}</span>
      <Select
        size='small'
        style={{ minWidth: 140 }}
        loading={loadingOrgs}
        value={org}
        placeholder={t('organization')}
        options={orgs.map((o) => ({ label: o, value: o }))}
        onChange={(nextOrg: string) => {
          const current = form.getFieldValue('query') || {};
          form.setFieldsValue({ query: { ...current, org: nextOrg, stream: undefined } });
          fetchStreams(nextOrg);
        }}
      />
      <span className='text-hint whitespace-nowrap'>{t('stream')}</span>
      <Select
        size='small'
        style={{ minWidth: 140 }}
        loading={loadingStreams}
        value={stream}
        placeholder={t('stream')}
        options={streams.map((s) => ({ label: s, value: s }))}
        onChange={(nextStream: string) => {
          const current = form.getFieldValue('query') || {};
          form.setFieldsValue({ query: { ...current, stream: nextStream } });
        }}
      />
    </Space>
  );
}
