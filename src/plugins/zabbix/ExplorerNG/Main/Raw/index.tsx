import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { Empty, message, Space, Dropdown, Button, Menu } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Form } from 'antd';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum } from '@/utils/constant';
import { parseRange } from '@/components/TimeRangePicker';
import { Field } from '@/pages/logExplorer/types';
import LogsViewer from '@/pages/logExplorer/components/LogsViewer';
import calcColWidthByData from '@/pages/logExplorer/components/LogsViewer/utils/calcColWidthByData';

import { NAME_SPACE } from '../../../constants';
import { DEFAULT_LOGS_PAGE_SIZE, DEFAULT_TIME_FIELD, INTERNAL_FIELDS, LOGS_OPTIONS_CACHE_KEY, LOGS_TABLE_COLUMNS_WIDTH_CACHE_KEY } from '../../constants';
import { logsQuery } from '../../services';
import { buildExportFilename, exportLogs, stripInternalFields, ExportFormat } from '../../utils/exportLogs';
import { getOptionsFromLocalstorage, setOptionsToLocalstorage } from '../../utils/optionsLocalstorage';

interface Props {
  tableSelector: {
    antd: string;
    rgd: string;
  };
  indexData: Field[];
  setExecuteLoading: (loading: boolean) => void;
  timeField?: string;
}

interface LogsData {
  list: Record<string, any>[];
  total: number;
  hash: string;
  colWidths?: Record<string, number>;
  fields: string[];
}

/** Fields produced by the platform for viewer plumbing, not Zabbix data. */
const HIDDEN_FIELDS = [...INTERNAL_FIELDS, 'timestamp', '__timestamp__'];

function filterFields(fieldKeys: string[]) {
  return _.filter(fieldKeys, (key) => !_.includes(HIDDEN_FIELDS, key));
}

function getFields(logs: Record<string, any>[]) {
  const fields: string[] = [];
  _.forEach(logs, (log) => {
    _.forEach(log, (_val, key) => {
      if (!_.includes(fields, key)) {
        fields.push(key);
      }
    });
  });
  return filterFields(_.sortBy(fields));
}

export default function Raw(props: Props) {
  const { t } = useTranslation(NAME_SPACE);
  const { tableSelector, indexData, setExecuteLoading, timeField } = props;
  const form = Form.useFormInstance();
  const refreshFlag = Form.useWatch('refreshFlag');
  const datasourceValue = Form.useWatch('datasourceValue');
  const [options, setOptions] = useState(getOptionsFromLocalstorage(LOGS_OPTIONS_CACHE_KEY));
  const pageLoadMode = options.pageLoadMode || 'pagination';
  const [serviceParams, setServiceParams] = useState({
    current: 1,
    pageSize: DEFAULT_LOGS_PAGE_SIZE,
    reverse: true,
    refreshFlag: undefined as string | undefined,
  });
  const [exporting, setExporting] = useState(false);

  const updateOptions = (newOptions, reload?: boolean) => {
    const mergedOptions = {
      ...options,
      ...newOptions,
    };
    setOptions(mergedOptions);
    setOptionsToLocalstorage(LOGS_OPTIONS_CACHE_KEY, mergedOptions);
    if (reload) {
      setServiceParams({
        current: 1,
        pageSize: DEFAULT_LOGS_PAGE_SIZE,
        reverse: true,
        refreshFlag: _.uniqueId('refreshFlag_'),
      });
    }
  };

  const service = () => {
    const latestQueryValues = form.getFieldValue('query');
    if (refreshFlag && datasourceValue && latestQueryValues?.range) {
      const parsedRange = parseRange(latestQueryValues.range);
      return logsQuery({
        cate: DatasourceCateEnum.zabbix,
        datasource_id: datasourceValue,
        query: [
          {
            query_type: latestQueryValues.query_type || 'problem',
            hostids: latestQueryValues.hostids,
            severities: latestQueryValues.severities,
            start: moment(parsedRange.start).valueOf(),
            end: moment(parsedRange.end).valueOf(),
            limit: serviceParams.pageSize,
            offset: (serviceParams.current - 1) * serviceParams.pageSize,
            ref: 'A',
            reverse: serviceParams.reverse,
          },
        ],
      })
        .then((res) => {
          const newData = _.map(res.list || [], withViewerKeys);
          return {
            list: newData,
            total: res.total,
            hash: _.uniqueId('zabbix_logs_'),
            colWidths: calcColWidthByData(newData),
            fields: getFields(newData),
          };
        })
        .catch((e: any) => {
          message.error(e?.message || e?.msg || 'Query failed');
          return {
            list: [],
            total: 0,
            hash: _.uniqueId('zabbix_logs_'),
            fields: [],
          };
        });
    }
    return Promise.resolve({
      list: [],
      total: 0,
      hash: _.uniqueId('zabbix_logs_'),
      fields: [],
    });
  };

  const {
    data,
    loading,
    run: fetchLogs,
  } = useRequest<LogsData, any>(service, {
    manual: true,
  });

  useEffect(() => {
    if (refreshFlag) {
      if (serviceParams.current !== 1) {
        setServiceParams((prev) => ({
          ...prev,
          current: 1,
        }));
      } else {
        fetchLogs();
      }
    }
  }, [refreshFlag]);

  useEffect(() => {
    if (refreshFlag) {
      fetchLogs();
    }
  }, [JSON.stringify(serviceParams)]);

  useEffect(() => {
    setExecuteLoading(loading);
  }, [loading, setExecuteLoading]);

  // Export re-queries with the current filter (not just the current page),
  // mirroring the log datasource behavior.
  const handleExport = async (format: ExportFormat) => {
    const latestQueryValues = form.getFieldValue('query');
    if (!datasourceValue || !latestQueryValues?.range) {
      message.warning(t('export.no_data'));
      return;
    }
    const parsedRange = parseRange(latestQueryValues.range);
    const total = data?.total ?? 0;
    const limit = Math.min(total > 0 ? total : 10000, 10000);
    setExporting(true);
    try {
      const res = await logsQuery({
        cate: DatasourceCateEnum.zabbix,
        datasource_id: datasourceValue,
        query: [
          {
            query_type: latestQueryValues.query_type || 'problem',
            hostids: latestQueryValues.hostids,
            severities: latestQueryValues.severities,
            start: moment(parsedRange.start).valueOf(),
            end: moment(parsedRange.end).valueOf(),
            limit,
            ref: 'export',
            reverse: true,
          },
        ],
      });
      const rows = stripInternalFields(_.map(res.list || [], withViewerKeys));
      if (_.isEmpty(rows)) {
        message.warning(t('export.no_data'));
        return;
      }
      await exportLogs(rows, format, buildExportFilename(format));
      message.success(t('export.success'));
    } catch (e: any) {
      message.error(e?.message || e?.msg || t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  return refreshFlag ? (
    <LogsViewer
      indexData={indexData}
      id_key='__n9e_id_n9e__'
      raw_key='__n9e_raw_n9e__'
      timeField={timeField || DEFAULT_TIME_FIELD}
      loading={loading}
      logs={data?.list || []}
      logsHash={data?.hash}
      fields={data?.fields || []}
      hideTypeIcon
      options={options}
      organizeFields={options.organizeFields}
      setOrganizeFields={(newOrganizeFields?: string[]) => {
        updateOptions({ organizeFields: newOrganizeFields || [] });
      }}
      filterFields={filterFields}
      logViewerFilterFields={(log) => filterFields(_.keys(log))}
      logCollapsedByDefault
      colWidths={data?.colWidths}
      tableColumnsWidthCacheKey={`${LOGS_TABLE_COLUMNS_WIDTH_CACHE_KEY}${JSON.stringify({ datasourceValue })}`}
      optionsExtraRender={
        <Space>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item key='csv' onClick={() => handleExport('csv')}>
                  {t('export.csv')}
                </Menu.Item>
                <Menu.Item key='xlsx' onClick={() => handleExport('xlsx')}>
                  {t('export.xlsx')}
                </Menu.Item>
                <Menu.Item key='json' onClick={() => handleExport('json')}>
                  {t('export.json')}
                </Menu.Item>
              </Menu>
            }
          >
            <Button size='small' icon={<DownloadOutlined />} loading={exporting}>
              {t('export.button')}
            </Button>
          </Dropdown>
        </Space>
      }
    />
  ) : (
    <Empty className='m-4' image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty.execute_first')} />
  );
}

/**
 * Zabbix event rows are already flat; add the viewer plumbing keys so
 * LogsViewer (shared with log datasources) can render ids and the JSON tab.
 */
function withViewerKeys(row: Record<string, any>) {
  return {
    ...row,
    __n9e_id_n9e__: _.uniqueId('zabbix_log_'),
    __n9e_raw_n9e__: row,
  };
}
