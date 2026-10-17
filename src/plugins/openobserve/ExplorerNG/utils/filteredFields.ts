import _ from 'lodash';

export const BUILTIN_FIELDS = ['__n9e_id_n9e__', '__n9e_raw_n9e__', '___id___', '___raw___', '__id__', '__raw__'];
export const VICTORIALOGS_BUILTIN_FIELDS = ['_msg', '_timestamp', '_stream_id', '_stream'];
export const BUILDER_SUGGESTION_BLOCKED_FIELDS = new Set(['_timestamp', '_msg', '_stream', '_stream_id']);

/**
 * 后端归一化结构（lokikit.NormalizedLog）的包装字段。
 * labels/parsed_fields 已由 utils/logRow 的 transformLogRow 拍平为顶层字段，
 * 这些包装键继续留在行里只供内部使用（时间排序、身份识别），展示与字段列表
 * 都要过滤掉，否则用户会看到 timestamp/line/labels 这类内部结构。
 * 注意不含 _timestamp：OpenObserve 原版 UI 把 _timestamp 当普通字段展示。
 */
export const NORMALIZED_HIDDEN_FIELDS = ['timestamp', '__timestamp__', 'labels', 'parsed_fields', 'line'];

export function isBuilderSuggestionBlockedField(field?: string) {
  if (!field) {
    return false;
  }
  return BUILDER_SUGGESTION_BLOCKED_FIELDS.has(field) || _.startsWith(field, '_stream.');
}

export function filterOutBuiltinFields(fields: string[]) {
  return _.filter(fields, (field) => !_.includes([...BUILTIN_FIELDS, ...NORMALIZED_HIDDEN_FIELDS], field));
}

export function filterOutBuilderSuggestionBlockedFields<T extends { field?: string }>(fields: T[]) {
  return _.filter(fields, (field) => !isBuilderSuggestionBlockedField(field.field));
}

export default function filteredFields(fieldKeys: string[], organizeFields?: string[]) {
  const availableFields = filterOutBuiltinFields(fieldKeys);
  if (!organizeFields || organizeFields.length === 0) return availableFields;
  return _.filter(organizeFields, (field) => _.includes(availableFields, field));
}
