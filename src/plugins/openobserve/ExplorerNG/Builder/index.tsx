import React, { useState } from 'react';
import _ from 'lodash';
import moment from 'moment';
import { Alert, Button, Form, Input, InputNumber, Row, Col, Select, Segmented, Space, Tooltip, Popover } from 'antd';
import { CloseOutlined, InfoCircleOutlined, PlusOutlined, PushpinOutlined, SearchOutlined } from '@ant-design/icons';
import classNames from 'classnames';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';

import { DatasourceCateEnum, SIZE } from '@/utils/constant';
import { parseRange } from '@/components/TimeRangePicker';
import useOnClickOutside from '@/components/useOnClickOutside';
import InputGroupWithFormItem from '@/components/InputGroupWithFormItem';

import { NAME_SPACE as VICTORIALOGS_NS } from '../../constants';
import { getFieldNames, getFieldValues } from '../services';
import { FieldNameSuggestion, OpenObserveAggregation, OpenObserveFilter, OpenObserveMetricBuilderState, OpenObserveRawBuilderState } from '../types';
import { renderLogsQL, renderMetricLogsQL } from '../utils/logsQL';
import getOperatorsByFieldType from '../utils/getOperatorsByFieldType';

interface Props {
  visible: boolean;
  mode: 'raw' | 'metric';
  queryBuilderPinned: boolean;
  setQueryBuilderPinned: (pinned: boolean) => void;
  onClose: () => void;
  /** 数据源配置的时间字段（默认 _timestamp），用于统计 SQL 的 date_trunc 时间桶 */
  timeField?: string;
  onExecute: (query: string, values: { raw?: OpenObserveRawBuilderState; metric?: OpenObserveMetricBuilderState; vizType?: 'table' | 'timeseries' }) => void;
  onPreviewQL: (query: string, values: { raw?: OpenObserveRawBuilderState; metric?: OpenObserveMetricBuilderState; vizType?: 'table' | 'timeseries' }) => void;
}

function RequiredLabel(props: { children: React.ReactNode }) {
  return (
    <span className='relative inline-flex items-center'>
      <span style={{ color: '#ff4d4f' }} className='absolute right-full mr-1'>
        *
      </span>
      {props.children}
    </span>
  );
}

const filterOperators = [
  { label: '=', value: 'eq' },
  { label: '!=', value: 'neq' },
  { label: 'contains', value: 'contains' },
  { label: 'not contains', value: 'not_contains' },
  { label: 'regex', value: 'regex' },
  { label: 'not regex', value: 'not_regex' },
  { label: '>', value: 'gt' },
  { label: '>=', value: 'gte' },
  { label: '<', value: 'lt' },
  { label: '<=', value: 'lte' },
  { label: 'exists', value: 'exists' },
  { label: 'not exists', value: 'not_exists' },
];

const aggregationOptions = [
  { label: 'count', value: 'count' },
  { label: 'count_uniq', value: 'count_uniq' },
  { label: 'sum', value: 'sum' },
  { label: 'avg', value: 'avg' },
  { label: 'min', value: 'min' },
  { label: 'max', value: 'max' },
  { label: 'quantile', value: 'quantile' },
];

const SUGGESTION_DEBOUNCE_WAIT = 600;

function getRangeUnix(range: any) {
  if (!range) return undefined;
  const parsed = parseRange(range);
  // 后端 openobserve 各 Query* 入口统一按毫秒契约（toMicros = ms * 1000），必须用 valueOf()
  return {
    start: moment(parsed.start).valueOf(),
    end: moment(parsed.end).valueOf(),
  };
}

function getSuggestionBaseQuery(filters?: OpenObserveFilter[], index?: number) {
  return renderLogsQL({ filters: typeof index === 'number' ? _.slice(filters || [], 0, index) : filters || [] });
}

function useFieldNameSuggestions(params: { datasourceValue?: number; range?: any; query: string; keyword: string; enabled?: boolean; org?: string; stream?: string }) {
  const range = React.useMemo(() => getRangeUnix(params.range), [JSON.stringify(params.range)]);
  return useRequest(
    () => {
      return getFieldNames({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: params.datasourceValue!,
        query: params.query || '*',
        start: range!.start,
        end: range!.end,
        filter: params.keyword,
        limit: 100,
        org: params.org,
        stream: params.stream,
      });
    },
    {
      refreshDeps: [params.datasourceValue, range?.start, range?.end, params.query, params.keyword, params.org, params.stream],
      ready: !!params.enabled && !!params.datasourceValue && !!range?.start && !!range?.end,
      debounceWait: SUGGESTION_DEBOUNCE_WAIT,
    },
  );
}

function useAggregationFieldSuggestions(params: { datasourceValue?: number; range?: any; query: string; enabled?: boolean; org?: string; stream?: string }) {
  const range = React.useMemo(() => getRangeUnix(params.range), [JSON.stringify(params.range)]);
  return useRequest(
    () => {
      return getFieldNames({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: params.datasourceValue!,
        query: params.query || '*',
        start: range!.start,
        end: range!.end,
        filter: '',
        limit: 100,
        org: params.org,
        stream: params.stream,
      });
    },
    {
      refreshDeps: [params.datasourceValue, params.query, !!range?.start, !!range?.end, params.org, params.stream],
      ready: !!params.enabled && !!params.datasourceValue && !!range?.start && !!range?.end,
      debounceWait: SUGGESTION_DEBOUNCE_WAIT,
    },
  );
}

function FieldSelect(props: {
  value?: string;
  onChange?: (value?: string) => void;
  datasourceValue?: number;
  range?: any;
  query: string;
  disabled?: boolean;
  org?: string;
  stream?: string;
  fieldsFilter?: (fields: FieldNameSuggestion[]) => FieldNameSuggestion[];
  onFieldChange?: (field?: FieldNameSuggestion) => void;
}) {
  const { value, onChange, datasourceValue, range, query, disabled, org, stream, fieldsFilter, onFieldChange } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [keyword, setKeyword] = useState('');
  const { data, loading } = useFieldNameSuggestions({ datasourceValue, range, query, keyword, enabled: !disabled, org, stream });
  const fields = fieldsFilter ? fieldsFilter(data || []) : data || [];
  const options = React.useMemo(() => {
    const manualField = _.trim(keyword || value);
    const items = manualField && !_.find(fields, { field: manualField }) ? [{ field: manualField }, ...fields] : fields;
    return _.map(items, (item) => ({ label: item.field, value: item.field }));
  }, [JSON.stringify(fields), value, keyword]);

  return (
    <Select
      allowClear
      disabled={disabled}
      loading={!disabled && loading}
      showSearch
      optionFilterProp='label'
      dropdownClassName='doris-query-builder-popup'
      dropdownMatchSelectWidth={false}
      placeholder={t('builder.field_placeholder')}
      value={value}
      options={options}
      onSearch={setKeyword}
      onChange={(next) => {
        onChange?.(next);
        onFieldChange?.(_.find(fields, { field: next }));
      }}
    />
  );
}

function CachedFieldSelect(props: { value?: string; onChange?: (value?: string) => void; disabled?: boolean; fields?: FieldNameSuggestion[]; loading?: boolean }) {
  const { value, onChange, disabled, fields, loading } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [keyword, setKeyword] = useState('');
  const options = React.useMemo(() => {
    const manualField = _.trim(keyword || value);
    const manual = manualField && !_.find(fields, { field: manualField }) ? [{ field: manualField }] : [];
    return _.map(_.uniqBy([...manual, ...(fields || [])], 'field'), (item) => ({ label: item.field, value: item.field }));
  }, [JSON.stringify(fields), value, keyword]);

  return (
    <Select
      allowClear
      disabled={disabled}
      loading={!disabled && loading}
      showSearch
      optionFilterProp='label'
      dropdownClassName='doris-query-builder-popup'
      dropdownMatchSelectWidth={false}
      placeholder={t('builder.field_placeholder')}
      value={value}
      options={options}
      onSearch={setKeyword}
      onChange={onChange}
    />
  );
}

function FieldTagsSelect(props: { value?: string[]; onChange?: (value?: string[]) => void; fields?: FieldNameSuggestion[]; loading?: boolean }) {
  const { value, onChange, fields, loading } = props;
  const [keyword, setKeyword] = useState('');
  const options = React.useMemo(() => {
    const current = _.map(value || [], (field) => ({ field }));
    const manual = _.trim(keyword) ? [{ field: _.trim(keyword) }] : [];
    return _.map(_.uniqBy([...manual, ...(fields || []), ...current], 'field'), (item) => ({ label: item.field, value: item.field }));
  }, [JSON.stringify(fields), JSON.stringify(value), keyword]);

  return (
    <Select
      size='small'
      className='min-w-[200px]'
      dropdownClassName='doris-query-builder-popup'
      dropdownMatchSelectWidth={false}
      mode='tags'
      tokenSeparators={[',', ' ']}
      loading={loading}
      showSearch
      optionFilterProp='label'
      value={value}
      options={options}
      onSearch={setKeyword}
      onChange={onChange}
    />
  );
}

function FieldValueSelect(props: { value?: any; onChange?: (value?: any) => void; datasourceValue?: number; range?: any; query: string; field?: string; org?: string; stream?: string }) {
  const { value, onChange, datasourceValue, range, query, field, org, stream } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [keyword, setKeyword] = useState('');
  const rangeUnix = React.useMemo(() => getRangeUnix(range), [JSON.stringify(range)]);
  const { data, loading } = useRequest(
    () => {
      return getFieldValues({
        cate: DatasourceCateEnum.openobserve,
        datasource_id: datasourceValue!,
        query: query || '*',
        start: rangeUnix!.start,
        end: rangeUnix!.end,
        field: field!,
        filter: keyword,
        limit: 100,
        org,
        stream,
      });
    },
    {
      refreshDeps: [datasourceValue, rangeUnix?.start, rangeUnix?.end, query, field, keyword],
      ready: !!datasourceValue && !!rangeUnix?.start && !!rangeUnix?.end && !!field,
      debounceWait: SUGGESTION_DEBOUNCE_WAIT,
    },
  );
  const options = React.useMemo(() => {
    const currentValue = _.toString(value);
    const manualValue = _.trim(keyword || currentValue);
    const current = manualValue && !_.find(data, { value: manualValue }) ? [{ value: manualValue, count: undefined }] : [];
    return [...current, ...(data || [])];
  }, [JSON.stringify(data), value, keyword]);

  return (
    <Select
      allowClear
      loading={loading}
      showSearch
      optionFilterProp='label'
      optionLabelProp='label'
      dropdownClassName='doris-query-builder-popup'
      dropdownMatchSelectWidth={false}
      placeholder={t('builder.value_placeholder')}
      value={value}
      onSearch={setKeyword}
      onChange={onChange}
    >
      {_.map(options, (item) => (
        <Select.Option key={item.value} value={item.value} label={item.value}>
          <div className='flex items-center justify-between gap-3'>
            <span>{item.value}</span>
            {item.count ? <span className='text-hint'>{item.count}</span> : null}
          </div>
        </Select.Option>
      ))}
    </Select>
  );
}

function getOrderByFieldOptions(aggregations?: OpenObserveAggregation[], groupBy?: string[]) {
  const aggregationFields = _.map(aggregations || [], (item) => _.trim(item.alias) || item.func || 'count');
  return _.map(_.uniq(_.compact([...aggregationFields, ...(groupBy || [])])), (field) => ({ label: field, value: field }));
}

function Describe(props: { children: React.ReactNode; onClose: (e: React.MouseEvent) => void; onCloseMouseDown?: (e: React.MouseEvent) => void }) {
  const { children, onClose, onCloseMouseDown } = props;
  return (
    <div className='border border-antd rounded-lg hover:bg-fc-150 min-h-[24px] wrap-break-word whitespace-normal cursor-pointer flex items-center justify-between'>
      <div
        className='h-full px-[7px] flex items-center'
        style={{
          borderRight: '1px solid var(--fc-antd-border-color)',
        }}
      >
        {children}
      </div>
      <Button className='p-0 min-h-[22px] bg-fc-150 hover:bg-fc-200' size='small' icon={<CloseOutlined />} type='text' onMouseDown={onCloseMouseDown} onClick={onClose} />
    </div>
  );
}

function filterText(item: OpenObserveFilter) {
  const opLabel = _.find(filterOperators, { value: item.op })?.label || item.op;
  if (item.op === 'exists' || item.op === 'not_exists') return opLabel;
  return `${opLabel} ${_.toString(item.value || '')}`;
}

function FilterPopover(props: {
  children: React.ReactNode;
  data?: OpenObserveFilter;
  filters?: OpenObserveFilter[];
  index?: number;
  datasourceValue?: number;
  range?: any;
  org?: string;
  stream?: string;
  onChange?: (data: OpenObserveFilter) => void;
  onAdd?: (data: OpenObserveFilter) => void;
  ignoreNextOutsideClick: () => void;
}) {
  const { children, data, filters, index, datasourceValue, range, org, stream, onChange, onAdd, ignoreNextOutsideClick } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [visible, setVisible] = useState<boolean>();
  const [form] = Form.useForm();
  const op = Form.useWatch('op', form);
  const field = Form.useWatch('field', form);
  const suggestionQuery = React.useMemo(() => getSuggestionBaseQuery(filters, index), [JSON.stringify(filters), index]);

  return (
    <Popover
      overlayClassName='doris-query-builder-popup'
      trigger='click'
      placement='bottomLeft'
      visible={visible}
      onVisibleChange={(v) => {
        ignoreNextOutsideClick();
        setVisible(v);
        if (v === false) {
          form
            .validateFields()
            .then((values) => {
              const next = {
                id: data?.id || _.uniqueId('filter_'),
                fieldSource: 'inferred',
                valueType: 'unknown',
                ...values,
              } as OpenObserveFilter;
              if (data) {
                onChange?.(next);
              } else {
                form.resetFields();
                onAdd?.(next);
              }
            })
            .catch(_.noop);
        } else if (v === true) {
          form.resetFields();
          if (data) {
            form.setFieldsValue(data);
          }
        }
      }}
      content={
        <div className='w-[480px] max-w-[calc(100vw-120px)]'>
          <Form form={form} layout='vertical' validateTrigger={[]}>
            <Row gutter={SIZE}>
              <Col span={12}>
                <Form.Item label={t('builder.field')} name='field' rules={[{ required: true, message: t('builder.select_field') }]}>
                  <FieldSelect
                    datasourceValue={datasourceValue}
                    range={range}
                    query={suggestionQuery}
                    org={org}
                    stream={stream}
                    onFieldChange={() => {
                      form.setFieldsValue({
                        op: _.head(getOperatorsByFieldType()) || 'eq',
                        value: undefined,
                      });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('builder.operator')} name='op' initialValue='eq' rules={[{ required: true, message: t('builder.select_operator') }]}>
                  <Select dropdownClassName='doris-query-builder-popup' placeholder={t('builder.operator_placeholder')} options={filterOperators} />
                </Form.Item>
              </Col>
              {op !== 'exists' && op !== 'not_exists' && (
                <Col span={24}>
                  <Form.Item label={t('builder.value')} name='value' rules={[{ required: true, message: t('builder.input_value') }]}>
                    <FieldValueSelect datasourceValue={datasourceValue} range={range} query={suggestionQuery} field={field} org={org} stream={stream} />
                  </Form.Item>
                </Col>
              )}
            </Row>
          </Form>
        </div>
      }
    >
      <div>{children}</div>
    </Popover>
  );
}

function Filters(props: {
  value?: OpenObserveFilter[];
  onChange?: (values: OpenObserveFilter[]) => void;
  ignoreNextOutsideClick: () => void;
  datasourceValue?: number;
  range?: any;
  org?: string;
  stream?: string;
}) {
  const { value, onChange, ignoreNextOutsideClick, datasourceValue, range, org, stream } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  return (
    <Space size={[SIZE, SIZE / 2]} wrap style={{ width: '100%' }}>
      {_.map(value, (item, index) => {
        if (!item.field || !item.op) return null;
        return (
          <FilterPopover
            key={`${item.id}-${index}`}
            data={item}
            filters={value}
            index={index}
            datasourceValue={datasourceValue}
            range={range}
            org={org}
            stream={stream}
            ignoreNextOutsideClick={ignoreNextOutsideClick}
            onChange={(values) => {
              onChange?.(_.map(value, (v, i) => (i === index ? values : v)));
            }}
          >
            <Describe
              onCloseMouseDown={(e) => {
                e.stopPropagation();
                ignoreNextOutsideClick();
              }}
              onClose={(e) => {
                e.stopPropagation();
                onChange?.(_.filter(value, (_, i) => i !== index));
              }}
            >
              <Space className='text-hint'>
                <span>{item.field}</span>
                <span>{filterText(item)}</span>
              </Space>
            </Describe>
          </FilterPopover>
        );
      })}
      <FilterPopover
        filters={value}
        index={(value || []).length}
        datasourceValue={datasourceValue}
        range={range}
        org={org}
        stream={stream}
        ignoreNextOutsideClick={ignoreNextOutsideClick}
        onAdd={(values) => onChange?.([...(value || []), values])}
      >
        <Button size='small' type='text' icon={<PlusOutlined />} className='hover:bg-fc-150'>
          {t('builder.add')}
        </Button>
      </FilterPopover>
    </Space>
  );
}

function AggregationPopover(props: {
  children: React.ReactNode;
  data?: OpenObserveAggregation;
  fields?: FieldNameSuggestion[];
  fieldsLoading?: boolean;
  onChange?: (data: OpenObserveAggregation) => void;
  onAdd?: (data: OpenObserveAggregation) => void;
  ignoreNextOutsideClick: () => void;
}) {
  const { children, data, fields, fieldsLoading, onChange, onAdd, ignoreNextOutsideClick } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [visible, setVisible] = useState<boolean>();
  const [form] = Form.useForm();
  const func = Form.useWatch('func', form);
  const currentFunc = func || data?.func || 'count';

  return (
    <Popover
      overlayClassName='doris-query-builder-popup'
      trigger='click'
      placement='bottomLeft'
      visible={visible}
      onVisibleChange={(v) => {
        ignoreNextOutsideClick();
        setVisible(v);
        if (v === false) {
          form
            .validateFields()
            .then((values) => {
              const next = { id: data?.id || _.uniqueId('aggregation_'), ...values } as OpenObserveAggregation;
              if (data) {
                onChange?.(next);
              } else {
                form.resetFields();
                onAdd?.(next);
              }
            })
            .catch(_.noop);
        } else if (v === true) {
          form.resetFields();
          if (data) {
            form.setFieldsValue(data);
          }
        }
      }}
      content={
        <div className='w-[480px] max-w-[calc(100vw-120px)]'>
          <Form form={form} layout='vertical' validateTrigger={[]}>
            <Row gutter={SIZE}>
              <Col span={12}>
                <Form.Item label={t('builder.function')} name='func' initialValue='count' rules={[{ required: true, message: t('builder.select_function') }]}>
                  <Select
                    dropdownClassName='doris-query-builder-popup'
                    placeholder={t('builder.function_placeholder')}
                    options={aggregationOptions}
                    onChange={(value) => {
                      if (value === 'count') {
                        form.setFieldsValue({ field: undefined });
                      }
                    }}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label={t('builder.field')} name='field' rules={[{ required: currentFunc !== 'count', message: t('builder.input_field') }]}>
                  <CachedFieldSelect disabled={currentFunc === 'count'} fields={fields} loading={fieldsLoading} />
                </Form.Item>
              </Col>
              {currentFunc === 'quantile' && (
                <Col span={12}>
                  <Form.Item label={t('builder.quantile')} name={['params', 'quantile']} initialValue={0.99} rules={[{ required: true, message: t('builder.input_quantile') }]}>
                    <InputNumber className='w-full' min={0} max={1} step={0.01} />
                  </Form.Item>
                </Col>
              )}
              <Col span={currentFunc === 'quantile' ? 12 : 24}>
                <Form.Item label={t('builder.alias')} name='alias'>
                  <Input placeholder={t('builder.alias_placeholder')} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      }
    >
      <div>{children}</div>
    </Popover>
  );
}

function Aggregates(props: {
  value?: OpenObserveAggregation[];
  onChange?: (values: OpenObserveAggregation[]) => void;
  ignoreNextOutsideClick: () => void;
  fields?: FieldNameSuggestion[];
  fieldsLoading?: boolean;
}) {
  const { value, onChange, ignoreNextOutsideClick, fields, fieldsLoading } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  return (
    <Space size={[SIZE, SIZE / 2]} wrap>
      {_.map(value, (item, index) => {
        if (!item.func) return null;
        return (
          <AggregationPopover
            key={`${item.id}-${index}`}
            data={item}
            fields={fields}
            fieldsLoading={fieldsLoading}
            ignoreNextOutsideClick={ignoreNextOutsideClick}
            onChange={(values) => {
              onChange?.(_.map(value, (v, i) => (i === index ? values : v)));
            }}
          >
            <Describe
              onCloseMouseDown={(e) => {
                e.stopPropagation();
                ignoreNextOutsideClick();
              }}
              onClose={(e) => {
                e.stopPropagation();
                onChange?.(_.filter(value, (_, i) => i !== index));
              }}
            >
              <Space className='text-hint'>
                <strong className='text-main bg-fc-200 px-1'>{item.func}</strong>
                {item.field && <span>{item.field}</span>}
                {item.alias ? (
                  <>
                    <strong className='text-main bg-fc-200 px-1'>AS</strong>
                    <span>{item.alias}</span>
                  </>
                ) : null}
              </Space>
            </Describe>
          </AggregationPopover>
        );
      })}
      <AggregationPopover fields={fields} fieldsLoading={fieldsLoading} ignoreNextOutsideClick={ignoreNextOutsideClick} onAdd={(values) => onChange?.([...(value || []), values])}>
        <Button size='small' type='text' icon={<PlusOutlined />} className='hover:bg-fc-150'>
          {t('builder.add')}
        </Button>
      </AggregationPopover>
    </Space>
  );
}

function OrderByPopover(props: {
  children: React.ReactNode;
  data?: { field: string; direction: 'asc' | 'desc' };
  fieldOptions: { label: string; value: string }[];
  onChange?: (data: { field: string; direction: 'asc' | 'desc' }) => void;
  onAdd?: (data: { field: string; direction: 'asc' | 'desc' }) => void;
  ignoreNextOutsideClick: () => void;
}) {
  const { children, data, fieldOptions, onChange, onAdd, ignoreNextOutsideClick } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const [visible, setVisible] = useState<boolean>();
  const [form] = Form.useForm();

  return (
    <Popover
      overlayClassName='doris-query-builder-popup'
      trigger='click'
      placement='bottomLeft'
      visible={visible}
      onVisibleChange={(v) => {
        ignoreNextOutsideClick();
        setVisible(v);
        if (v === false) {
          form.validateFields().then((values) => {
            if (data) {
              onChange?.(values);
            } else {
              form.resetFields();
              onAdd?.(values);
            }
          });
        } else if (v === true && data) {
          form.setFieldsValue(data);
        }
      }}
      content={
        <div className='w-[400px] max-w-[calc(100vw-120px)]'>
          <Form form={form} layout='vertical'>
            <Row gutter={SIZE}>
              <Col span={16}>
                <Form.Item label={t('builder.field')} name='field' rules={[{ required: true, message: t('builder.input_field') }]}>
                  <Select
                    dropdownClassName='doris-query-builder-popup'
                    dropdownMatchSelectWidth={false}
                    showSearch
                    optionFilterProp='label'
                    options={fieldOptions}
                    placeholder={t('builder.field_placeholder')}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label={t('builder.direction')} name='direction' initialValue='desc' rules={[{ required: true, message: t('builder.select_direction') }]}>
                  <Select
                    dropdownClassName='doris-query-builder-popup'
                    options={[
                      { label: 'asc', value: 'asc' },
                      { label: 'desc', value: 'desc' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      }
    >
      <div>{children}</div>
    </Popover>
  );
}

function OrderBy(props: {
  value?: { field: string; direction: 'asc' | 'desc' }[];
  onChange?: (values: { field: string; direction: 'asc' | 'desc' }[]) => void;
  ignoreNextOutsideClick: () => void;
  fieldOptions: { label: string; value: string }[];
}) {
  const { value, onChange, ignoreNextOutsideClick, fieldOptions } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  return (
    <Space size={SIZE} wrap>
      {_.map(value, (item, index) => {
        if (!item.field || !item.direction) return null;
        return (
          <OrderByPopover
            key={`${item.field}-${item.direction}-${index}`}
            data={item}
            fieldOptions={fieldOptions}
            ignoreNextOutsideClick={ignoreNextOutsideClick}
            onChange={(values) => onChange?.(_.map(value, (v, i) => (i === index ? values : v)))}
          >
            <Describe
              onClose={(e) => {
                e.stopPropagation();
                onChange?.(_.filter(value, (_, i) => i !== index));
              }}
            >
              <Space className='text-hint'>
                <span>{item.field}</span>
                <strong className='text-main bg-fc-200 px-1'>{item.direction}</strong>
              </Space>
            </Describe>
          </OrderByPopover>
        );
      })}
      <OrderByPopover fieldOptions={fieldOptions} ignoreNextOutsideClick={ignoreNextOutsideClick} onAdd={(values) => onChange?.([...(value || []), values])}>
        <Button size='small' type='text' icon={<PlusOutlined />} className='hover:bg-fc-150'>
          {t('builder.add')}
        </Button>
      </OrderByPopover>
    </Space>
  );
}

export default function Builder(props: Props) {
  const { visible, mode, queryBuilderPinned, setQueryBuilderPinned, onClose, onExecute, onPreviewQL, timeField } = props;
  const { t } = useTranslation(VICTORIALOGS_NS);
  const parentForm = Form.useFormInstance();
  const [form] = Form.useForm();
  const [validationMessage, setValidationMessage] = useState<string>();
  const datasourceValue = Form.useWatch('datasourceValue', parentForm);
  const queryValues = Form.useWatch('query', parentForm);
  const filters = Form.useWatch('filters', form);
  const aggregates = Form.useWatch('aggregations', form);
  const groupBy = Form.useWatch('groupBy', form);
  const eleRef = React.useRef<HTMLDivElement>(null);
  const skipOutsideClickRef = React.useRef(false);
  const filterOnlyQuery = React.useMemo(() => getSuggestionBaseQuery(filters), [JSON.stringify(filters)]);
  const orderByFieldOptions = React.useMemo(() => getOrderByFieldOptions(aggregates, groupBy), [JSON.stringify(aggregates), JSON.stringify(groupBy)]);
  const { data: aggregationFields, loading: aggregationFieldsLoading } = useAggregationFieldSuggestions({
    datasourceValue,
    range: queryValues?.range,
    query: filterOnlyQuery,
    enabled: visible && mode === 'metric' && Array.isArray(filters),
    org: queryValues?.org,
    stream: queryValues?.stream,
  });

  const ignoreNextOutsideClick = () => {
    skipOutsideClickRef.current = true;
  };

  useOnClickOutside(eleRef, (e) => {
    const target = (e as Event)?.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' && target.closest('.doris-query-builder-popup')) {
      return;
    }
    if (skipOutsideClickRef.current) {
      skipOutsideClickRef.current = false;
      return;
    }
    onClose();
  });

  React.useEffect(() => {
    if (!visible) {
      form.resetFields();
      return;
    }
    form.resetFields();
    const builder = queryValues?.builder || {};
    if (mode === 'metric') {
      form.setFieldsValue({
        filters: builder.metric?.filters || builder.raw?.filters || [],
        aggregations: builder.metric?.aggregations || [],
        groupBy: builder.metric?.groupBy || [],
        orderBy: builder.metric?.orderBy || [],
        limit: builder.metric?.limit || undefined,
        vizType: queryValues?.vizType || builder.metric?.vizType || 'table',
      });
    } else {
      form.setFieldsValue({
        filters: builder.raw?.filters || builder.metric?.filters || [],
      });
    }
  }, [visible, mode]);

  const getRenderResult = () => {
    const values = form.getFieldsValue();
    if (mode === 'metric') {
      const metric = values as OpenObserveMetricBuilderState;
      // stream 取自外层 Explorer 表单（OrgStreamSelector 写入 query.stream）；
      // Builder 自己的 form 没有 query 字段，此前读 values.query?.stream 恒为 undefined 导致 FROM ""
      const stream = queryValues?.stream;
      return {
        query: renderMetricLogsQL(metric, { multiline: true }, stream, timeField),
        values: {
          metric,
          raw: { filters: values.filters || [] },
          vizType: values.vizType,
        },
      };
    }
    const raw = values as OpenObserveRawBuilderState;
    return {
      query: renderLogsQL(raw),
      values: { raw },
    };
  };

  const validateBuilder = () => {
    const values = form.getFieldsValue();
    if (mode === 'metric' && !_.some(values.aggregations || [], (item) => item?.func)) {
      setValidationMessage(t('builder.aggregation_required'));
      return false;
    }
    setValidationMessage(undefined);
    return true;
  };

  return (
    <div
      ref={eleRef}
      className={classNames('w-full relative border border-antd rounded bg-fc-100 px-3 py-2 shadow-sm', {
        // 未固定：文档流内展开（把下方图表推开而不是悬浮遮挡），高亮边框提示激活态；
        // 面板 zIndex 低于「查询条件」标签(z-index:3)，让标签的连接饰条(::after)压在面板上沿形成 tab 咬合
        'border-primary': !queryBuilderPinned,
      })}
      style={{
        zIndex: 2,
        display: visible ? 'block' : 'none',
      }}
    >
      <Form form={form} layout='vertical'>
        <div className='w-full table border-separate border-spacing-y-2'>
          <div className='table-column w-[52px]' />
          <div className='table-column' />
          <div className='table-row'>
            <div className='table-cell align-top'>
              <div className='h-[24px] flex items-center'>
                <Tooltip title={t('builder.filter_relation_tip')}>
                  <Space size={SIZE / 2}>
                    <span>{t('builder.filter')}</span>
                    <InfoCircleOutlined />
                  </Space>
                </Tooltip>
              </div>
            </div>
            <div className='table-cell'>
              <Form.Item name='filters' noStyle>
                <Filters datasourceValue={datasourceValue} range={queryValues?.range} org={queryValues?.org} stream={queryValues?.stream} ignoreNextOutsideClick={ignoreNextOutsideClick} />
              </Form.Item>
            </div>
          </div>
          <div className={mode === 'metric' ? 'table-row' : 'hidden'}>
            <div className='table-cell align-top'>
              <div className='h-[24px] flex items-center'>
                <RequiredLabel>{t('builder.aggregation')}</RequiredLabel>
              </div>
            </div>
            <div className='table-cell'>
              <Form.Item name='aggregations' noStyle>
                <Aggregates fields={aggregationFields} fieldsLoading={aggregationFieldsLoading} ignoreNextOutsideClick={ignoreNextOutsideClick} />
              </Form.Item>
            </div>
          </div>
          <div className={mode === 'metric' ? 'table-row' : 'hidden'}>
            <div className='table-cell align-top'>
              <div className='h-[24px] flex items-center'>{t('builder.display')}</div>
            </div>
            <div className='table-cell'>
              <Space size={SIZE} wrap>
                <Form.Item name='vizType' noStyle initialValue='table'>
                  <Segmented
                    size='small'
                    options={[
                      { label: t('builder.statistical_value'), value: 'table' },
                      { label: t('builder.timeseries'), value: 'timeseries' },
                    ]}
                  />
                </Form.Item>
                <InputGroupWithFormItem size='small' label={t('builder.group_by')}>
                  <Form.Item name='groupBy' noStyle>
                    <FieldTagsSelect fields={aggregationFields} loading={aggregationFieldsLoading} />
                  </Form.Item>
                </InputGroupWithFormItem>
                <InputGroupWithFormItem size='small' label={t('builder.limit')}>
                  <Form.Item name='limit' noStyle>
                    <InputNumber size='small' className='w-[100px]' min={1} max={10000000} />
                  </Form.Item>
                </InputGroupWithFormItem>
              </Space>
            </div>
          </div>
          <div className={mode === 'metric' ? 'table-row' : 'hidden'}>
            <div className='table-cell align-top'>
              <div className='h-[24px] flex items-center'>{t('builder.order_by')}</div>
            </div>
            <div className='table-cell'>
              <Form.Item name='orderBy' noStyle>
                <OrderBy fieldOptions={orderByFieldOptions} ignoreNextOutsideClick={ignoreNextOutsideClick} />
              </Form.Item>
            </div>
          </div>
        </div>
        {validationMessage && <Alert className='mt-3' showIcon type='warning' message={validationMessage} />}
        <div className='mt-2 flex items-center justify-between gap-2'>
          <Space size={SIZE}>
            <Button
              size='small'
              type='primary'
              icon={<SearchOutlined />}
              onClick={() => {
                if (!validateBuilder()) return;
                const res = getRenderResult();
                onExecute(res.query, res.values);
              }}
            >
              {t('builder.execute')}
            </Button>
            <Button
              size='small'
              onClick={() => {
                if (!validateBuilder()) return;
                const res = getRenderResult();
                onPreviewQL(res.query, res.values);
              }}
            >
              {t('builder.preview_ql')}
            </Button>
          </Space>
          <Tooltip title={queryBuilderPinned ? t('builder.unpin') : t('builder.pin')}>
            <Button
              size='small'
              type='text'
              icon={<PushpinOutlined />}
              onMouseDown={() => {
                ignoreNextOutsideClick();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setQueryBuilderPinned(!queryBuilderPinned);
              }}
            >
              {queryBuilderPinned ? t('builder.unpin') : t('builder.pin')}
            </Button>
          </Tooltip>
        </div>
      </Form>
    </div>
  );
}
