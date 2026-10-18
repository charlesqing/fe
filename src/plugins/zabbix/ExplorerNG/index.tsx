import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import { Form } from 'antd';

import { DefaultFormValuesControl, RenderCommonSettings } from '@/pages/logExplorer/types';

import { NAME_SPACE } from '../constants';
import { DEFAULT_LIMIT } from './constants';
import Main from './Main';

interface Props {
  tabKey: string;
  disabled?: boolean;
  defaultFormValuesControl?: DefaultFormValuesControl;
  renderCommonSettings: RenderCommonSettings;
}

export default function index(props: Props) {
  const { tabKey, defaultFormValuesControl, renderCommonSettings } = props;
  const form = Form.useFormInstance();
  const [executeLoading, setExecuteLoading] = useState(false);

  const executeQuery = () => {
    setTimeout(() => {
      form
        .validateFields()
        .then(() => {
          form.setFieldsValue({
            refreshFlag: _.uniqueId('refreshFlag_'),
          });
        })
        .catch(() => undefined);
    }, 0);
  };

  useEffect(() => {
    if (defaultFormValuesControl?.isInited) {
      const query = form.getFieldValue('query');
      if (query?.builder || query?.builderStatus || query?.querySource) {
        form.setFieldsValue({
          query: {
            ...query,
            builder: undefined,
            builderStatus: undefined,
            querySource: undefined,
          },
        });
      }
    }
  }, [defaultFormValuesControl?.isInited]);

  return (
    <div className={`h-full ${NAME_SPACE}-explorer-container zabbix-explorer-container-${tabKey}`}>
      <Form.Item name='refreshFlag' hidden>
        <div />
      </Form.Item>
      <Form.Item name={['query', 'builder']} hidden>
        <div />
      </Form.Item>
      <Form.Item name={['query', 'builderStatus']} hidden>
        <div />
      </Form.Item>
      <Form.Item name={['query', 'querySource']} hidden>
        <div />
      </Form.Item>
      <div className='h-full flex flex-col'>
        {renderCommonSettings({
          getDefaultQueryValues: () => ({
            query_type: 'problem',
            hostids: [],
            severities: [],
            limit: DEFAULT_LIMIT,
          }),
          executeQuery,
          layout: 'horizontal',
        })}
        <Main tabKey={tabKey} indexData={[]} executeLoading={executeLoading} setExecuteLoading={setExecuteLoading} executeQuery={executeQuery} />
      </div>
    </div>
  );
}
