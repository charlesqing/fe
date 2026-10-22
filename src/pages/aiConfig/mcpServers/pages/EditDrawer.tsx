import React, { useState, useEffect } from 'react';
import { Button, Drawer, Form, Space, Spin, Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useRequest } from 'ahooks';

import { NS, HEADERS_MASK } from '../constants';
import { getItem, putItem, testConnection } from '../services';
import type { Item } from '../types';
import FormCpt from './Form';
import { adjustFormValues, adjustSubmitValues } from '../utils/adjustFormValues';

interface Props {
  id?: number;

  visible: boolean;
  onOk: () => void;
  onClose: () => void;
}

export default function EditDrawer(props: Props) {
  const { t } = useTranslation(NS);
  const { visible, onOk, onClose, id } = props;
  const [form] = Form.useForm();
  const [item, setItem] = useState<Item>();
  const isSystemConfig = item?.created_by === 'system';

  const { loading } = useRequest(
    () => {
      if (!id) {
        return Promise.resolve(null);
      }
      return getItem(id);
    },
    {
      refreshDeps: [id],
      onSuccess(data) {
        if (data) {
          setItem(data);
          form.resetFields();
          form.setFieldsValue(adjustFormValues(data));
        }
      },
    },
  );

  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setTestLoading(false);
      setItem(undefined);
    }
  }, [visible, form]);

  return (
    <Drawer
      width={700}
      title={t('form.edit_title')}
      placement='right'
      visible={visible}
      onClose={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common:btn.cancel')}</Button>
          <Button
            loading={testLoading}
            onClick={() => {
              form.validateFields().then((values) => {
                // 详情接口遮蔽 header 值后，表单里未修改的项是掩码 ********；
                // 拿掩码去测连接必然 401，先拦下来要求补真实值。
                if (values.headers?.some((h) => h.value === HEADERS_MASK)) {
                  message.warning(t('form.headers_masked_test_warning'));
                  return;
                }
                setTestLoading(true);
                testConnection(adjustSubmitValues(values))
                  .then((res) => {
                    if (res.error) {
                      Modal.error({
                        title: t('form.test_connection_failure'),
                        content: <div>Error: {typeof res.error === 'string' ? res.error : JSON.stringify(res.error)}</div>,
                      });
                    } else {
                      Modal.success({
                        title: t('form.test_connection_success'),
                        content: <div>{t('form.test_connection_result', { count: res.tool_count ?? 0 })}</div>,
                      });
                    }
                  })
                  .finally(() => {
                    setTestLoading(false);
                  });
              });
            }}
          >
            {t('form.test_connection')}
          </Button>
          <Button
            type='primary'
            onClick={() => {
              if (!id) return;
              form.validateFields().then((values) => {
                putItem(id, adjustSubmitValues(values)).then(() => {
                  onOk();
                });
              });
            }}
          >
            {t('common:btn.save')}
          </Button>
        </Space>
      }
      className='n9e-antd-drawer'
    >
      <Spin spinning={loading}>
        <FormCpt form={form} isSystemConfig={isSystemConfig} />
      </Spin>
    </Drawer>
  );
}
