import React, { useContext, useMemo, useState } from 'react';
import { Descriptions, Modal, Space, Spin, Typography } from 'antd';
import type uPlot from 'uplot';
import _ from 'lodash';

import TimeRangePicker from '@/components/TimeRangePicker';
import type { IRawTimeRange } from '@/components/TimeRangePicker';
import { timeRangeUnix } from '@/components/TimeRangePicker/utils';
import UPlotChart, { axisBuilder, cursorBuider, paddingSide, seriesBuider, tooltipPlugin } from '@/components/UPlotChart';
import { formatTime } from '@/components/UPlotChart/utils/axisBuilder';
import getDataFrameAndBaseSeries from '@/pages/dashboard/Renderer/Renderer/TimeSeriesNG/utils/getDataFrameAndBaseSeries';
import type { OldSeriesItem } from '@/pages/dashboard/Renderer/Renderer/TimeSeriesNG/utils/getDataFrameAndBaseSeries';
import getTextWidth from '@/pages/dashboard/Renderer/utils/getTextWidth';
import { hexPalette } from '@/pages/dashboard/config';
import { CommonStateContext } from '@/App';

import { DEFAULT_TIME_RANGE } from '../constants';
import type { ZabbixLatestDataRow, ZabbixSeries } from '../services';
import { queryZabbixChartData } from '../services';
import { formatNumber, formatLatestValue, seriesStats, zabbixTimeSplits } from '../utils';

/**
 * 单监控项趋势图弹窗：
 *   - 复用通用 ds-query 通道取数（窗口 > 3 天后端自动切换 trend.get 小时聚合）；
 *   - 图表走平台 UPlotChart 管线（getDataFrameAndBaseSeries 对齐 + seriesBuider）；
 *   - X 轴固定为所选时间窗（对齐 Zabbix 原生图形：窗口前段无采集数据时留白，
 *     而不是把曲线压缩到数据实际跨度）；
 *   - 顶部统计摘要（最新 / 平均 / 最小 / 最大 / 数据点）帮助运维快速读数。
 */
export default function ItemChartModal({
  open,
  item,
  datasourceId,
  onClose,
}: {
  open: boolean;
  item: ZabbixLatestDataRow | undefined;
  datasourceId: number | undefined;
  onClose: () => void;
}) {
  const { darkMode } = useContext(CommonStateContext);
  const [timeRange, setTimeRange] = useState<IRawTimeRange>(DEFAULT_TIME_RANGE as IRawTimeRange);
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<ZabbixSeries[]>([]);
  // X 轴固定窗口（unix 秒）：跟随最近一次查询范围
  const [axisRange, setAxisRange] = useState<[number, number] | undefined>();

  const chartId = useMemo(() => `zabbix-item-chart-${item?.itemid || 'none'}`, [item?.itemid]);

  const fetchData = (range: IRawTimeRange) => {
    if (!datasourceId || !item) {
      return;
    }
    const { start, end } = timeRangeUnix(range);
    setAxisRange([start, end]);
    setLoading(true);
    queryZabbixChartData({ datasource_id: datasourceId, itemids: [item.itemid], start, end })
      .then(setSeries)
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  };

  // item 变化或弹窗打开时拉取
  React.useEffect(() => {
    if (open && item) {
      fetchData(timeRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.itemid, datasourceId]);

  const { frames, baseSeries } = useMemo(() => {
    const oldSeries: OldSeriesItem[] = _.map(series, (s) => ({
      id: s.ref,
      refId: s.ref,
      metric: s.metric,
      name: _.get(s.metric, 'itemname') || item?.name || 'value',
      data: s.values,
    }));
    return getDataFrameAndBaseSeries(oldSeries);
  }, [series, item?.name]);

  const stats = useMemo(() => seriesStats(series), [series]);
  const hasData = frames[0]?.length > 0;

  const options = useMemo(() => {
    const width = Math.min(typeof window !== 'undefined' ? window.innerWidth - 160 : 800, 900);
    const height = 320;
    const theme = darkMode ? 'dark' : 'light';
    return {
      width,
      height,
      padding: [paddingSide, paddingSide, paddingSide, paddingSide] as any,
      legend: { show: false },
      plugins: [
        tooltipPlugin({
          id: chartId,
          mode: 'all' as const,
          sort: 'none' as const,
          pinningEnabled: true,
          // tooltip overlay 挂在 document.body 上，默认 z-index 999 会被
          // antd Modal（z-index 1000）盖住，表现为有十字线但看不到 tooltip
          zIndex: 1999,
        }),
      ],
      cursor: cursorBuider({}),
      // X 轴固定为查询窗口：无数据的前段保留空白时间轴（Zabbix 原生行为），
      // 否则 uplot 会把轴收缩到数据实际跨度，看起来像"数据少了"
      scales: (axisRange ? { x: { range: () => axisRange } } : {}) as any,
      series: seriesBuider({
        baseSeries,
        colors: hexPalette,
        pathsType: 'linear' as const,
        width: 2,
        fillOpacity: 0.1,
      }),
      axes: [
        // X 轴刻度对齐 Zabbix 原生图形：间隔由 Zabbix 的
        // drawDateTimeIntervals 算法选取（如 12h→15min、24h→30min），
        // 标签竖排（与 Zabbix 相同），密度高时不重叠
        axisBuilder({
          isTime: true,
          theme,
          space: () => 1,
          splits: ((self: uPlot, _axisIdx: number, scaleMin: number, scaleMax: number) =>
            zabbixTimeSplits(scaleMin, scaleMax)) as any,
          values: formatTime as any,
          tickLabelRotation: 90,
          size: ((self: uPlot, values: (string | null)[]) => {
            const maxWidth = (values ?? []).reduce(
              (acc, v) => Math.max(acc, getTextWidth(String(v ?? '') || '')),
              0,
            );
            return Math.ceil(4 + 5 + (maxWidth || 20));
          }) as any,
        }),
        axisBuilder({
          scaleKey: 'y',
          theme,
          formatValue: (v: number) => formatNumber(v, item?.units || ''),
        }),
      ],
    } as any;
  }, [chartId, baseSeries, darkMode, item?.units, axisRange]);

  return (
    <Modal
      title={
        item ? (
          <Space size={8} wrap>
            <span>趋势图</span>
            <Typography.Text type='secondary' style={{ fontWeight: 400, fontSize: 12 }}>
              {item.name}
              {item.units ? `（${item.units}）` : ''}
            </Typography.Text>
          </Space>
        ) : (
          '趋势图'
        )
      }
      visible={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
    >
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <TimeRangePicker
          value={timeRange}
          dateFormat='YYYY-MM-DD HH:mm:ss'
          onChange={(range) => {
            setTimeRange(range);
            fetchData(range);
          }}
        />
      </div>

      {stats && (
        <Descriptions size='small' column={5} style={{ marginBottom: 8 }}>
          <Descriptions.Item label='最新值'>
            <Typography.Text strong>{formatNumber(stats.last, item?.units || '')}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label='平均'>{formatNumber(stats.avg, item?.units || '')}</Descriptions.Item>
          <Descriptions.Item label='最小'>{formatNumber(stats.min, item?.units || '')}</Descriptions.Item>
          <Descriptions.Item label='最大'>{formatNumber(stats.max, item?.units || '')}</Descriptions.Item>
          <Descriptions.Item label='数据点'>{stats.count}</Descriptions.Item>
        </Descriptions>
      )}

      <Spin spinning={loading}>
        {hasData ? (
          <UPlotChart id={chartId} options={options} data={frames as any} />
        ) : (
          <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography.Text type='secondary'>{loading ? '加载中…' : '该时间窗内没有采集数据，试试放大时间范围'}</Typography.Text>
          </div>
        )}
      </Spin>

      {item && (
        <Typography.Paragraph type='secondary' style={{ marginTop: 12, marginBottom: 0, fontSize: 12 }}>
          key: <Typography.Text code>{item.key_}</Typography.Text>
          {item.description ? ` · ${item.description}` : ''} · 当前最新值:{' '}
          <Typography.Text code>{formatLatestValue(item)}</Typography.Text>
        </Typography.Paragraph>
      )}
    </Modal>
  );
}
