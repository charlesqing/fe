import { OpenObserveFilter } from '../types';

const operators: OpenObserveFilter['op'][] = ['eq', 'neq', 'contains', 'not_contains', 'regex', 'not_regex', 'gt', 'gte', 'lt', 'lte', 'exists', 'not_exists'];

export default function getOperatorsByFieldType(): OpenObserveFilter['op'][] {
  return operators;
}
