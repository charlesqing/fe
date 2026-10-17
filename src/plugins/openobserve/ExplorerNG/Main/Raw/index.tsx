import React, { useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { Empty, message, Pagination, Select, Space, Dropdown, Menu, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Form } from 'antd';
import { useRequest } from 'ahooks';
import { Trans, useTranslation } from 'react-i18next';

import { DatasourceCateEnum, IS_PLUS } from '@/utils/constant';
import { parseRange } from '@/components/TimeRangePicker';
import { NAME_SPACE as logExplorerNS } from '@/pages/logExplorer/constants';
import LogsViewer from '@/pages/logExplorer/components/LogsViewer';
import calcColWidthByData from '@/pages/logExplorer/components/LogsViewer/utils/calcColWidthByData';

import { NAME_SPACE } from '../../../constants';
import { DEFAULT_LOGS_PAGE_SIZE, DEFAULT_TIME_FIELD, LOGS_OPTIONS_CACHE_KEY, LOGS_TABLE_COLUMNS_WIDTH_CACHE_KEY } from '../../constants';
import { getHistogram, logsQuery } from '../../services';
import { Field } from '../../types';
import filteredFields, { filterOutBuiltinFields } from '../../utils/filteredFields';
import { formatTimeFieldValue, transformLogRow } from '../../utils/logRow';
import { getOptionsFromLocalstorage, setOptionsToLocalstorage } from '../../utils/optionsLocalstorage';
import renderLogViewerFieldValueWithoutFilters from '../../utils/renderLogViewerFieldValueWithoutFilters';
import useFieldConfig from '@/pages/logExplorer/components/RenderValue/useFieldConfig';
import { getIsAtBottom, scrollToTop } from '../../utils/tableElementMethods';
import ContextViewer from './components/ContextViewer';
import { buildExportFilename, exportLogs, stripInternalFields, EXPORT_MAX_ROWS, ExportFormat } from '../../utils/exportLogs';

// @ts-ignore
import DownloadModal from 'plus:/components/LogDownload/DownloadModal';

interface Props {
  tableSelector: {
    antd: string;
    rgd: string;
  };
  indexData: Field[];
  setExecuteLoading: (loading: boolean) => void;
  executeQuery: () => void;
  snapRangeResetKey?: string;
  /** 数据源配置的时间字段（默认 _timestamp），用于时间列展示 */
  timeField?: string;
}

interface LogsData {
  list: Record<string, any>[];
  total: number;
  hash: string;
  colWidths?: Record<string, number>;
  fields: string[];
}

interface HistogramData {
  data: any[];
  hash: string;
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
  return filterOutBuiltinFields(_.sortBy(fields));
}

function isNoDataError(error: any) {
  const code = _.toLower(
    _.toString(error?.code || error?.error_type || error?.errorType || error?.data?.code || error?.response?.data?.code || error?.response?.data?.error_type || ''),
  );
  if (code === 'no_data' || code === 'no-data') return true;

  const legacyMessage = _.toLower(_.trim(_.toString(error?.message || error?.msg || error?.data?.message || error?.response?.data?.message || error?.response?.data?.msg || '')));
  return legacyMessage === 'no data';
}

export default function Raw(props: Props) {
  const { t } = useTranslation(NAME_SPACE);
  const { tableSelector, indexData, setExecuteLoading, executeQuery, snapRangeResetKey, timeField } = props;
  const form = Form.useFormInstance();
  const refreshFlag = Form.useWatch('refreshFlag');
  const datasourceValue = Form.useWatch('datasourceValue');
  const queryValues = Form.useWatch('query');
  const [options, setOptions] = useState(getOptionsFromLocalstorage(LOGS_OPTIONS_CACHE_KEY));
  const pageLoadMode = options.pageLoadMode || 'pagination';
  const appendRef = useRef(false);
  const fixedRangeRef = useRef(false);
  const loadTimeRef = useRef<number | null>(null);
  const [serviceParams, setServiceParams] = useState({
    current: 1,
    pageSize: DEFAULT_LOGS_PAGE_SIZE,
    reverse: true,
    refreshFlag: undefined as string | undefined,
  });
  const rangeRef = useRef<{
    from: number;
    to: number;
  }>();
  const [exporting, setExporting] = useState(false);
  const snapRangeRef = useRef<{
    from?: number;
    to?: number;
  }>({});
  const snapRangeResetKeyRef = useRef<string>();
  const serviceParamsEffectReadyRef = useRef(false);

  if (snapRangeResetKey && snapRangeResetKeyRef.current !== snapRangeResetKey) {
    snapRangeRef.current = {};
    snapRangeResetKeyRef.current = snapRangeResetKey;
  }

  const updateOptions = (newOptions, reload?: boolean) => {
    const mergedOptions = {
      ...options,
      ...newOptions,
    };
    setOptions(mergedOptions);
    setOptionsToLocalstorage(LOGS_OPTIONS_CACHE_KEY, mergedOptions);
    if (reload) {
      appendRef.current = false;
      setServiceParams({
        current: 1,
        pageSize: DEFAULT_LOGS_PAGE_SIZE,
        reverse: true,
        refreshFlag: _.uniqueId('refreshFlag_'),
      });
    }
  };

  /**
   * 日志导出（对齐 openobserve 原版 Download logs）：按当前查询条件重新拉取，
   * 而非只导出当前页——用户要的是"这次查询匹配的全部日志"。
   * 时间窗优先取最近一次实际执行的窗口（rangeRef，含直方图框选/上下文吸附后的
   * 窄窗），回退到时间选择器的值；单次上限 EXPORT_MAX_ROWS 条，超出提示截断。
   */
  const handleExport = async (format: ExportFormat) => {
    const latestQueryValues = form.getFieldValue('query');
    if (!datasourceValue || !latestQueryValues?.range) {
      message.warning(t('export.no_data'));
      return;
    }
    const parsedRange = parseRange(latestQueryValues.range);
    const executedRange = rangeRef.current ?? {
      from: moment(parsedRange.start).valueOf(),
      to: moment(parsedRange.end).valueOf(),
    };
    const total = data?.total ?? 0;
    const limit = Math.min(total > 0 ? total : EXPORT_MAX_ROWS, EXPORT_MAX_ROWS);
    setExporting(true);
    try {
      const res = await logsQuery({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue,
        query: [
          {
            query: _.trim(latestQueryValues.query || '*') || '*',
            start: moment(executedRange.from).valueOf(),
            end: moment(executedRange.to).valueOf(),
            limit,
            ref: 'export',
            org: latestQueryValues?.org,
            stream: latestQueryValues?.stream,
          },
        ],
      });
      const rows = stripInternalFields(_.map(res.list || [], transformLogRow));
      if (_.isEmpty(rows)) {
        message.warning(t('export.no_data'));
        return;
      }
      await exportLogs(rows, format, buildExportFilename(format));
      if (total > EXPORT_MAX_ROWS) {
        message.info(t('export.max_limit', { total, max: EXPORT_MAX_ROWS }));
      } else {
        message.success(t('export.success'));
      }
    } catch (e: any) {
      message.error(e?.message || e?.msg || t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  const service = () => {
    const latestQueryValues = form.getFieldValue('query');
    if (refreshFlag && datasourceValue && latestQueryValues?.range) {
      const parsedRange = parseRange(latestQueryValues.range);
      let timeParams =
        fixedRangeRef.current === false
          ? {
              from: moment(parsedRange.start).valueOf(),
              to: moment(parsedRange.end).valueOf(),
            }
          : rangeRef.current!;
      if (snapRangeRef.current?.from && snapRangeRef.current?.to) {
        timeParams = snapRangeRef.current as { from: number; to: number };
      }
      rangeRef.current = timeParams;
      const queryStart = Date.now();
      return logsQuery({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue,
        query: [
          {
            query: _.trim(latestQueryValues.query || '*') || '*',
            start: moment(timeParams.from).valueOf(),
            end: moment(timeParams.to).valueOf(),
            limit: serviceParams.pageSize,
            offset: (serviceParams.current - 1) * serviceParams.pageSize,
            ref: 'A',
            reverse: serviceParams.reverse,
            org: latestQueryValues?.org,
            stream: latestQueryValues?.stream,
          },
        ],
      })
        .then((res) => {
          if (fixedRangeRef.current === false) {
            loadTimeRef.current = Date.now() - queryStart;
          }
          const newData = _.map(res.list || [], transformLogRow);
          if (appendRef.current) {
            appendRef.current = false;
            const mergedList = _.concat(data?.list || [], newData);
            return {
              list: mergedList,
              total: res.total,
              hash: _.uniqueId('logs_'),
              colWidths: calcColWidthByData(mergedList),
              fields: getFields(mergedList),
            };
          }
          if (pageLoadMode === 'infiniteScroll') {
            scrollToTop(tableSelector.antd, tableSelector.rgd);
          }
          appendRef.current = false;
          return {
            list: newData,
            total: res.total,
            hash: _.uniqueId('logs_'),
            colWidths: calcColWidthByData(newData),
            fields: getFields(newData),
          };
        })
        .catch((e: any) => {
          appendRef.current = false;
          if (isNoDataError(e)) {
            return {
              list: [],
              total: 0,
              hash: _.uniqueId('logs_'),
              fields: [],
            };
          }
          message.error(e?.message || e?.msg || 'Query failed');
          loadTimeRef.current = null;
          return {
            list: [],
            total: 0,
            hash: _.uniqueId('logs_'),
            fields: [],
          };
        })
        .finally(() => {
          fixedRangeRef.current = false;
        });
    }
    return Promise.resolve({
      list: [],
      total: 0,
      hash: _.uniqueId('logs_'),
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

  const histogramService = () => {
    const latestQueryValues = form.getFieldValue('query');
    if (refreshFlag && datasourceValue && latestQueryValues?.range) {
      const range = parseRange(latestQueryValues.range);
      return getHistogram({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue,
        query: [
          {
            query: _.trim(latestQueryValues.query || '*') || '*',
            start: moment(range.start).valueOf(),
            end: moment(range.end).valueOf(),
            org: latestQueryValues?.org,
            stream: latestQueryValues?.stream,
          },
        ],
      })
        .then((res) => {
          return {
            data: _.map(res, (item) => ({
              id: _.uniqueId('series_'),
              ref: item.ref,
              name: item.ref || 'logs',
              metric: item.ref || 'logs',
              data: _.map(item.values || [], (value) => [value[0], value[1] === null ? 0 : value[1]]),
            })),
            hash: _.uniqueId('histogram_'),
          };
        })
        .catch((e: any) => {
          // 直方图失败不阻塞主列表，但需给用户可见反馈（此前静默降级，用户无从判断分布缺失原因）；
          // 文案与同文件主列表 catch 保持一致（上游模式）
          message.error(e?.message || e?.msg || 'Query failed');
          return {
            data: [],
            hash: _.uniqueId('histogram_'),
          };
        });
    }
    return Promise.resolve({
      data: [],
      hash: _.uniqueId('histogram_'),
    });
  };

  const { data: histogramData, loading: histogramLoading } = useRequest<HistogramData, any>(histogramService, {
    refreshDeps: [refreshFlag],
  });

  useEffect(() => {
    if (refreshFlag) {
      appendRef.current = false;
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
    if (!serviceParamsEffectReadyRef.current) {
      serviceParamsEffectReadyRef.current = true;
      return;
    }
    if (refreshFlag) {
      fetchLogs();
    }
  }, [JSON.stringify(serviceParams)]);

  useEffect(() => {
    setExecuteLoading(loading || histogramLoading);
  }, [loading, histogramLoading, setExecuteLoading]);

  const organizeFields = options.organizeFields;
  const setOrganizeFields = (newOrganizeFields?: string[]) => {
    updateOptions({ organizeFields: newOrganizeFields || [] });
  };

  const currentFieldConfig = useFieldConfig(
    {
      cate: DatasourceCateEnum.openobserve,
      datasource_id: datasourceValue,
      query: queryValues?.query,
    },
    refreshFlag,
  );

  return refreshFlag ? (
    <>
      {!_.isEmpty(data?.list) || !_.isEmpty(histogramData?.data) ? (
        <LogsViewer
          fieldConfig={currentFieldConfig}
          indexData={indexData}
          range={queryValues?.range}
          id_key='__n9e_id_n9e__'
          raw_key='__n9e_raw_n9e__'
          timeField={timeField || DEFAULT_TIME_FIELD}
          histogramLoading={histogramLoading}
          histogram={histogramData?.data || []}
          histogramHash={histogramData?.hash}
          loading={loading}
          logs={data?.list || []}
          logsHash={data?.hash}
          fields={data?.fields || []}
          hideTypeIcon
          options={options}
          organizeFields={organizeFields}
          setOrganizeFields={setOrganizeFields}
          filterFields={(fieldKeys) => filteredFields(fieldKeys, organizeFields)}
          logViewerFilterFields={(log) => filteredFields(_.keys(log), organizeFields)}
          logViewerExtraRender={(log) => (
            <ContextViewer log={log} datasourceValue={datasourceValue} org={queryValues?.org} stream={queryValues?.stream} />
          )}
          customLogFieldRender={renderLogViewerFieldValueWithoutFilters}
          logCollapsedByDefault
          timeFieldColumnFormat={formatTimeFieldValue}
          renderHistogramAddonAfterRender={(toggleNode) => {
            if (data) {
              return (
                <Space>
                  {rangeRef.current && (
                    <>
                      {moment(rangeRef.current?.from).format('YYYY-MM-DD HH:mm:ss.SSS')} ~ {moment(rangeRef.current?.to).format('YYYY-MM-DD HH:mm:ss.SSS')}
                    </>
                  )}
                  {toggleNode}
                  {IS_PLUS && <DownloadModal marginLeft={0} queryData={{ ...form.getFieldsValue(), mode: 'raw', total: data?.total }} />}
                </Space>
              );
            }
            return toggleNode;
          }}
          colWidths={data?.colWidths}
          tableColumnsWidthCacheKey={`${LOGS_TABLE_COLUMNS_WIDTH_CACHE_KEY}${JSON.stringify({ datasourceValue })}`}
          optionsExtraRender={
            <Space>
              {loadTimeRef.current !== null && (
                <Space size={4}>
                  <span>{t(`${logExplorerNS}:logs.duration`)} :</span>
                  <span>{loadTimeRef.current} ms</span>
                </Space>
              )}
              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item key='csv' onClick={() => handleExport('csv')}>
                      CSV
                    </Menu.Item>
                    <Menu.Item key='xlsx' onClick={() => handleExport('xlsx')}>
                      XLSX
                    </Menu.Item>
                    <Menu.Item key='json' onClick={() => handleExport('json')}>
                      JSON
                    </Menu.Item>
                  </Menu>
                }
              >
                <Button size='small' loading={exporting} icon={<DownloadOutlined />}>
                  {t('export.logs')}
                </Button>
              </Dropdown>
              {pageLoadMode === 'pagination' && (
                <Select
                  size='small'
                  value={serviceParams.pageSize}
                  onChange={(pageSize) => {
                    appendRef.current = false;
                    fixedRangeRef.current = true;
                    setServiceParams((prev) => ({
                      ...prev,
                      current: 1,
                      pageSize,
                    }));
                  }}
                  style={{ width: 90 }}
                  options={[
                    { label: '30 / page', value: 30 },
                    { label: '50 / page', value: 50 },
                    { label: '100 / page', value: 100 },
                    { label: '200 / page', value: 200 },
                    { label: '500 / page', value: 500 },
                    { label: '1000 / page', value: 1000 },
                  ]}
                />
              )}
              {pageLoadMode === 'pagination' ? (
                <Pagination
                  showQuickJumper
                  size='small'
                  total={data?.total}
                  current={serviceParams.current}
                  pageSize={serviceParams.pageSize}
                  onChange={(current, pageSize) => {
                    appendRef.current = false;
                    fixedRangeRef.current = true;
                    setServiceParams((prev) => ({
                      ...prev,
                      current,
                      pageSize,
                    }));
                  }}
                  showTotal={(total) => {
                    return (
                      <Space>
                        <span>{t(`${logExplorerNS}:logs.count`)} :</span>
                        <span>{total}</span>
                      </Space>
                    );
                  }}
                />
              ) : (
                <Space size={4}>
                  <span>{t(`${logExplorerNS}:logs.count`)} :</span>
                  <span>{data?.total}</span>
                </Space>
              )}
            </Space>
          }
          onOptionsChange={updateOptions}
          onScrollCapture={() => {
            if (loading || pageLoadMode !== 'infiniteScroll') return;
            const isAtBottom = getIsAtBottom(tableSelector.antd, tableSelector.rgd);
            if (isAtBottom && data && data.list.length < data.total) {
              appendRef.current = true;
              fixedRangeRef.current = true;
              setServiceParams((prev) => ({
                ...prev,
                current: prev.current + 1,
              }));
            }
          }}
          onRangeChange={(range) => {
            const query = form.getFieldValue('query') || {};
            snapRangeRef.current = {};
            form.setFieldsValue({
              query: {
                ...query,
                range,
              },
            });
            executeQuery();
          }}
          onLogRequestParamsChange={(params) => {
            if (params.from && params.to) {
              snapRangeRef.current = {
                from: params.from * 1000,
                to: params.to * 1000,
              };
              setServiceParams((prev) => ({
                ...prev,
                current: 1,
                refreshFlag: _.uniqueId('refreshFlag_'),
              }));
            }
            if (params.reverse !== undefined) {
              setServiceParams((prev) => ({
                ...prev,
                current: 1,
                reverse: params.reverse,
              }));
            }
          }}
          linesColumnFormat={(val) => {
            if (pageLoadMode === 'infiniteScroll') return val;
            return serviceParams.pageSize * (serviceParams.current - 1) + val;
          }}
        />
      ) : (
        <div className='h-full flex items-center justify-center'>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )}
    </>
  ) : (
    <div className='h-full flex items-center justify-center'>
      <Empty
        className='ant-empty-normal'
        image='/image/img_execute.svg'
        description={
          <Trans
            ns={logExplorerNS}
            i18nKey='before_query'
            components={{
              b: (
                <a
                  onClick={() => {
                    executeQuery();
                  }}
                />
              ),
            }}
          />
        }
        imageStyle={{ height: 80 }}
      />
    </div>
  );
}
