import React, { useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import type { InputRef } from 'antd';
import { Button, Drawer, Empty, Input, Modal, Row, Col, Space, Table, Tooltip, message } from 'antd';
import { CloseOutlined, LeftOutlined, PlusOutlined, PlusSquareOutlined, RightOutlined, CloseSquareOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum } from '@/utils/constant';

import { NAME_SPACE } from '../../../../constants';
import { logsQuery } from '../../../services';
import filteredFields from '../../../utils/filteredFields';
import { transformLogRow } from '../../../utils/logRow';
import { getContextTimeRanges, getLogIdentity, mergeContextLogs } from '../utils/context';

interface Props {
  log?: Record<string, any>;
  datasourceValue?: number;
  org?: string;
  stream?: string;
}

interface ContextLogRow extends Record<string, any> {
  __context_id__: string;
  __offset__: number;
  __current__?: boolean;
}

/** 单次拉取的上下文条数 */
const STEP_LINES = 30;
const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

function DynamicTags(props: { newTagText?: string; value?: string[]; onChange?: (tags: string[]) => void }) {
  const { newTagText = 'New Tag', value = [], onChange } = props;
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (inputVisible) inputRef.current?.focus();
  }, [inputVisible]);

  const confirmInput = () => {
    if (inputValue && !_.includes(value, inputValue)) {
      onChange?.([...value, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  return (
    <Space size={0}>
      {_.map(value, (tag) => (
        <span key={tag} className='inline-flex'>
          <Input
            ref={inputRef}
            size='small'
            value={tag}
            readOnly
            style={{ width: 120 }}
            suffix={
              <CloseOutlined
                onClick={() => {
                  onChange?.(_.filter(value, (item) => item !== tag));
                }}
              />
            }
          />
        </span>
      ))}
      {inputVisible ? (
        <Input
          ref={inputRef}
          className='min-w-[80px]'
          size='small'
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={confirmInput}
          onPressEnter={confirmInput}
        />
      ) : (
        <Button size='small' onClick={() => setInputVisible(true)} icon={<PlusOutlined />}>
          {newTagText}
        </Button>
      )}
    </Space>
  );
}

function OrganizeFields(props: { fields: string[]; organizeFields: string[]; onChange: (fields: string[]) => void }) {
  const { t } = useTranslation(NAME_SPACE);
  const { fields, organizeFields, onChange } = props;
  const [visible, setVisible] = useState(false);
  const [currentFields, setCurrentFields] = useState(organizeFields);

  useEffect(() => {
    setCurrentFields(organizeFields);
  }, [JSON.stringify(organizeFields)]);

  return (
    <>
      <Button
        size='small'
        onClick={() => {
          setVisible(true);
        }}
      >
        <Space>
          {t('context.organize_fields')}
          {!_.isEmpty(organizeFields) && (
            <Tooltip title={t('context.organize_fields_tip', { fields: _.join(organizeFields, ', ') })}>
              <EyeInvisibleOutlined className='text-gray-500' />
            </Tooltip>
          )}
        </Space>
      </Button>
      <Modal
        className='log-explorer-ignore-click-away'
        title={t('context.organize_fields')}
        visible={visible}
        onOk={() => {
          onChange(currentFields);
          setVisible(false);
        }}
        onCancel={() => {
          setVisible(false);
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <div>
              <div className='border border-solid border-fc-300 border-b-0 py-2 px-4'>
                <h3 className='m-0'>{t('context.all_fields')}</h3>
              </div>
              <div className='border border-solid border-fc-300 p-4 overflow-y-auto h-[450px]'>
                {_.map(_.xor(fields, currentFields), (field) => (
                  <div
                    key={field}
                    className='cursor-pointer mb-2'
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentFields([...currentFields, field]);
                    }}
                  >
                    <Space>
                      <PlusSquareOutlined />
                      {field}
                    </Space>
                  </div>
                ))}
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div>
              <div className='border border-solid border-fc-300 border-b-0 py-2 px-4'>
                <h3 className='m-0'>{t('context.show_fields')}</h3>
              </div>
              <div className='border border-solid border-fc-300 p-4 overflow-y-auto h-[450px]'>
                {_.isEmpty(currentFields) && <div className='text-gray-400'>{t('context.show_fields_empty')}</div>}
                {_.map(currentFields, (field) => (
                  <div
                    key={field}
                    className='cursor-pointer mb-2'
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentFields(_.filter(currentFields, (item) => item !== field));
                    }}
                  >
                    <Space>
                      <CloseSquareOutlined />
                      {field}
                    </Space>
                  </div>
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Modal>
    </>
  );
}

function toContextRows(logs: Record<string, any>[], currentLog: Record<string, any>): ContextLogRow[] {
  const currentIdentity = getLogIdentity(currentLog);
  const currentIndex = _.findIndex(logs, (item) => getLogIdentity(item) === currentIdentity);
  return _.map(logs, (item, index) => {
    const identity = getLogIdentity(item);
    return {
      ...item,
      __context_id__: identity,
      __offset__: currentIndex === -1 ? index : index - currentIndex,
      __current__: identity === currentIdentity,
    };
  });
}

function getDocumentFields(record?: Record<string, any>) {
  if (!record) return {};
  return _.pick(record, filteredFields(_.keys(record)));
}

/**
 * OpenObserve 数据源的「搜索上下文」（对齐 OpenObserve 原版 Search Around 与
 * Loki 插件 ContextViewer 的平台模式）：
 * - 拉取锚点日志前后各 2 小时窗口内、同数据流的日志（不带原查询过滤）；
 * - 当前日志高亮居中，offset 列为相对当前日志的条数偏移；
 * - 支持「更早 / 当前日志 / 更新」翻页、字段设置与关键词过滤。
 */
export default function ContextViewer(props: Props) {
  const { t } = useTranslation(NAME_SPACE);
  const { log, datasourceValue, org, stream } = props;
  const [open, setOpen] = useState(false);
  const [organizeFields, setOrganizeFields] = useState<string[]>([]);
  const [filterKeywords, setFilterKeywords] = useState<string[]>([]);
  const scrollTarget = useRef<'top' | 'bottom' | 'current'>('current');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<{ flag: string; list: Record<string, any>[] } | undefined>();

  const queryContextLogs = async (params: { anchorLog: Record<string, any>; mode: 'initial' | 'top' | 'bottom' }) => {
    if (!log || !datasourceValue) {
      return { flag: _.uniqueId('openobserve_context_'), list: [] };
    }
    const currentLog = log;
    const ranges = getContextTimeRanges(currentLog.__timestamp__);
    if (!ranges) {
      return { flag: _.uniqueId('openobserve_context_'), list: [] };
    }

    const runQuery = (range: { start: number; end: number }, direction: 'backward' | 'forward') => {
      return logsQuery({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue,
        query: [
          {
            // 搜索上下文刻意不带原查询过滤，呈现存储中的完整上下文
            query: '*',
            start: range.start,
            end: range.end,
            limit: STEP_LINES,
            reverse: direction === 'backward',
            skip_count: true,
            org,
            stream,
            ref: direction === 'backward' ? 'context_backward' : 'context_forward',
          },
        ],
      }).then((res) => _.map(res.list || [], transformLogRow));
    };

    if (params.mode === 'top') {
      let backwardLogs: Record<string, any>[] = [];
      try {
        backwardLogs = await runQuery(ranges.backward, 'backward');
      } catch (e) {
        message.error(t('context.query_failed'));
        return { flag: _.uniqueId('openobserve_context_'), list: dataRef.current?.list || [] };
      }
      if (_.isEmpty(backwardLogs)) {
        message.info(t('context.no_more_top'));
      }
      return {
        flag: _.uniqueId('openobserve_context_'),
        list: mergeContextLogs(currentLog, backwardLogs, dataRef.current?.list || []),
      };
    }

    if (params.mode === 'bottom') {
      let forwardLogs: Record<string, any>[] = [];
      try {
        forwardLogs = await runQuery(ranges.forward, 'forward');
      } catch (e) {
        message.error(t('context.query_failed'));
        return { flag: _.uniqueId('openobserve_context_'), list: dataRef.current?.list || [] };
      }
      if (_.isEmpty(forwardLogs)) {
        message.info(t('context.no_more_bottom'));
      }
      return {
        flag: _.uniqueId('openobserve_context_'),
        list: mergeContextLogs(currentLog, dataRef.current?.list || [], forwardLogs),
      };
    }

    const [backwardRes, forwardRes] = await Promise.allSettled([runQuery(ranges.backward, 'backward'), runQuery(ranges.forward, 'forward')]);
    const backwardLogs = backwardRes.status === 'fulfilled' ? backwardRes.value : [];
    const forwardLogs = forwardRes.status === 'fulfilled' ? forwardRes.value : [];
    if (backwardRes.status === 'rejected' || forwardRes.status === 'rejected') {
      message.error(t('context.query_failed'));
    }
    return {
      flag: _.uniqueId('openobserve_context_'),
      list: mergeContextLogs(currentLog, backwardLogs, forwardLogs),
    };
  };

  const { data, loading, run } = useRequest<
    {
      flag: string;
      list: Record<string, any>[];
    },
    any
  >(queryContextLogs, {
    manual: true,
  });

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (open && log) {
      scrollTarget.current = 'current';
      run({
        anchorLog: log,
        mode: 'initial',
      });
    }
  }, [open, getLogIdentity(log)]);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    window.setTimeout(() => {
      if (scrollTarget.current === 'top') {
        container.scrollTo({ top: 0 });
        return;
      }
      if (scrollTarget.current === 'bottom') {
        container.scrollTo({ top: container.scrollHeight });
        return;
      }
      const currentIdentity = getLogIdentity(log);
      const row = _.find(Array.from(container.querySelectorAll('tr[data-row-key]')), (item) => item.getAttribute('data-row-key') === currentIdentity) as
        | HTMLElement
        | undefined;
      if (row) {
        container.scrollTo({
          top: Math.max(0, row.offsetTop - (container.clientHeight - row.clientHeight) / 2),
        });
      }
    }, 100);
  }, [data?.flag, log]);

  const dataSource = useMemo(() => (log ? toContextRows(data?.list || [], log) : []), [data?.flag, log]);
  const availableFields = useMemo(() => {
    const rows = log ? [log, ...dataSource] : dataSource;
    return _.sortBy(_.uniq(_.flatMap(rows, (item) => _.keys(getDocumentFields(item)))));
  }, [data?.flag, log]);
  const filteredDataSource = useMemo(() => {
    return _.filter(dataSource, (item) => {
      if (_.isEmpty(filterKeywords)) return true;
      const text = JSON.stringify(getDocumentFields(item));
      return _.some(filterKeywords, (keyword) => _.includes(text, keyword));
    });
  }, [dataSource, filterKeywords]);

  const tableColumns = useMemo(() => {
    return [
      {
        key: 'offset',
        width: 56,
        render: (record: ContextLogRow) => (
          <span className={record.__offset__ < 0 ? 'text-red-500' : 'text-green-500'}>{record.__offset__}</span>
        ),
      },
      {
        key: 'document',
        render: (record: ContextLogRow) => {
          const fields = getDocumentFields(record);
          const pickedFields = _.isEmpty(organizeFields) ? fields : _.pick(fields, organizeFields);
          return (
            <Space wrap>
              {record.timestamp && <span>[{moment(record.timestamp).format(TIME_FORMAT)}]</span>}
              {_.map(pickedFields, (value, key) => (
                <span key={key}>
                  <span className='font-bold whitespace-nowrap'>{key}</span>:{' '}
                  <span className='text-gray-500'>{_.isPlainObject(value) || _.isArray(value) ? JSON.stringify(value) : _.toString(value ?? '')}</span>
                </span>
              ))}
            </Space>
          );
        },
      },
    ];
  }, [organizeFields]);

  if (!log || !log.__timestamp__) return null;

  return (
    <>
      <Button
        size='small'
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('context.title')}
      </Button>
      <Drawer
        className='n9e-antd-drawer log-explorer-ignore-click-away'
        title={t('context.title')}
        extra={
          <CloseOutlined
            onClick={() => {
              setOpen(false);
            }}
          />
        }
        placement='right'
        onClose={() => {
          setOpen(false);
        }}
        visible={open}
        width='80%'
        destroyOnClose
        bodyStyle={{ padding: 10 }}
      >
        <div
          className='flex flex-col h-full'
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className='flex-shrink-0 mb-2 pb-2 border-0 border-b border-solid border-fc-200'>
            <Space wrap>
              <Space size={2}>
                <Button
                  size='small'
                  onClick={() => {
                    if (!_.isEmpty(data?.list)) {
                      scrollTarget.current = 'top';
                      run({
                        anchorLog: data!.list[0],
                        mode: 'top',
                      });
                    }
                  }}
                >
                  <Space size={2}>
                    <LeftOutlined />
                    {t('context.back_lines_btn')}
                  </Space>
                </Button>
                <Button
                  size='small'
                  onClick={() => {
                    scrollTarget.current = 'current';
                    run({
                      anchorLog: log,
                      mode: 'initial',
                    });
                  }}
                >
                  {t('context.current_lines_btn')}
                </Button>
                <Button
                  size='small'
                  onClick={() => {
                    if (!_.isEmpty(data?.list)) {
                      scrollTarget.current = 'bottom';
                      run({
                        anchorLog: data!.list[data!.list.length - 1],
                        mode: 'bottom',
                      });
                    }
                  }}
                >
                  <Space size={0}>
                    {t('context.forward_lines_btn')}
                    <RightOutlined />
                  </Space>
                </Button>
              </Space>
              <OrganizeFields fields={availableFields} organizeFields={organizeFields} onChange={setOrganizeFields} />
              <DynamicTags newTagText={t('context.filter_keywords_add')} value={filterKeywords} onChange={setFilterKeywords} />
            </Space>
            {!_.isEmpty(filterKeywords) && (
              <div className='mt-2'>
                <Space>
                  <span>{t('context.filter_keywords')}:</span>
                  <DynamicTags newTagText={t('context.filter_keywords_add')} value={filterKeywords} onChange={setFilterKeywords} />
                </Space>
              </div>
            )}
          </div>
          <div
            ref={tableContainerRef}
            className='min-h-0 flex-1 overflow-y-auto'
          >
            {_.isEmpty(filteredDataSource) && !loading ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                rowKey='__context_id__'
                size='small'
                showHeader={false}
                pagination={false}
                loading={loading}
                dataSource={filteredDataSource}
                columns={tableColumns}
                rowClassName={(record: ContextLogRow) => (record.__current__ ? 'bg-purple-950/[0.1]' : '')}
              />
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
}
