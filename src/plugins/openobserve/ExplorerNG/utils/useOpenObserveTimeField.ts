import React, { useContext, useMemo } from 'react';
import _ from 'lodash';

import { CommonStateContext } from '@/App';
import { DatasourceCateEnum } from '@/utils/constant';

/**
 * 读取 OpenObserve 数据源配置的时间字段（settings['openobserve.time_field']）。
 *
 * 后端 raw 查询用 oo.timeField() 尊重该配置，前端展示（LogsViewer 时间列）与
 * Builder 产出的统计 SQL（date_trunc 时间桶）必须使用同一口径，否则自定义
 * 时间字段的数据源会出现「查询按配置列、展示按 _timestamp」的错位。
 *
 * 数据源尚未加载或未配置时回退 '_timestamp'（与 Datasource/Form.tsx 的占位符一致）。
 */
type DatasourceWithSettings = { id: number; settings?: Record<string, string | undefined> };

export function useOpenObserveTimeField(datasourceValue?: number): string {
  const { groupedDatasourceList } = useContext(CommonStateContext);
  return useMemo(() => {
    const list = groupedDatasourceList?.[DatasourceCateEnum.openobserve] || [];
    // groupedDatasourceList 的 Datasource 类型未声明 settings，按平台既有模式断言补齐
    // （参考 plugins/prometheus/Dashboard/variableDatasource.ts）
    const datasource = _.find(list, { id: datasourceValue }) as DatasourceWithSettings | undefined;
    const timeField = _.trim(datasource?.settings?.['openobserve.time_field']);
    return timeField || '_timestamp';
  }, [groupedDatasourceList, datasourceValue]);
}

export default useOpenObserveTimeField;
