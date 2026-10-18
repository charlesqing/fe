import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Empty } from 'antd';
import { useRequest } from 'ahooks';

import PageLayout from '@/components/pageLayout';
import { CommonStateContext } from '@/App';
import { DatasourceCateEnum } from '@/utils/constant';

import './index.less';

import QueryBar from './QueryBar';
import type { HostFilterValues } from './QueryBar';
import HostTable from './HostTable';
import LatestDataDrawer from './LatestData';
import ProblemsDrawer from './ProblemsDrawer';
import ItemChartModal from './ItemChartModal';
import type { ZabbixHostSearchRow, ZabbixLatestDataRow } from './services';
import { searchZabbixHosts } from './services';
import { initialHostPage } from './utils';

const EMPTY_FILTERS: HostFilterValues = { name: '', ip: '', status: undefined, groupids: [] };

/**
 * Zabbix 主机查询页（参照 Zabbix「监测 > 主机」）：
 *
 *   筛选栏（名称 / IP / 状态 / 群组）
 *     └─ 主机列表（服务端分页，点击行 / 问题徽标 / 操作按钮）
 *          ├─ 最新数据抽屉（搜索 + 筛选预设 + 自动刷新）
 *          │    └─ 单监控项趋势图弹窗（时间范围 + 统计摘要）
 *          └─ 问题列表抽屉（严重级筛选 + 时间窗 + 自动刷新）
 *
 * 状态管理：筛选与分页提升到容器；抽屉内关键词 / 页码 / 刷新间隔为抽屉内部
 * 状态（换主机自动重置）；图表弹窗只吃 item + datasourceId 两个输入。
 */
export default function ZabbixQueryPage() {
  const { groupedDatasourceList } = useContext(CommonStateContext);
  const zabbixDatasources = ((groupedDatasourceList || {})[DatasourceCateEnum.zabbix] || []) as { id: number; name: string }[];

  const [datasourceId, setDatasourceId] = useState<number | undefined>();
  const [filters, setFilters] = useState<HostFilterValues>(EMPTY_FILTERS);
  const [hostPage, setHostPage] = useState(initialHostPage());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedHost, setSelectedHost] = useState<ZabbixHostSearchRow | undefined>();
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [problemsHost, setProblemsHost] = useState<ZabbixHostSearchRow | undefined>();
  const [chartItem, setChartItem] = useState<ZabbixLatestDataRow | undefined>();

  // ---- 主机检索（manual：查询按钮 / 翻页 / 数据源切换触发） ----
  const { data: hostResult, loading: hostLoading, run: runHostSearch } = useRequest(
    (params: HostFilterValues & { offset: number; limit: number }) =>
      searchZabbixHosts({
        cate: DatasourceCateEnum.zabbix,
        datasource_id: datasourceId!,
        name: params.name,
        ip: params.ip,
        status: params.status,
        groupids: params.groupids,
        offset: params.offset,
        limit: params.limit,
      }),
    { manual: true },
  );

  const searchHosts = useCallback(
    (filterValues: HostFilterValues, page: { current: number; pageSize: number }) => {
      if (!datasourceId) {
        return;
      }
      runHostSearch({
        ...filterValues,
        offset: (page.current - 1) * page.pageSize,
        limit: page.pageSize,
      });
    },
    [datasourceId, runHostSearch],
  );

  // 默认选中第一个 zabbix 数据源；数据源列表变化时纠正失效选择
  useEffect(() => {
    if (zabbixDatasources.length === 0) {
      setDatasourceId(undefined);
      return;
    }
    if (!datasourceId || !zabbixDatasources.some((ds) => ds.id === datasourceId)) {
      setDatasourceId(zabbixDatasources[0].id);
    }
  }, [zabbixDatasources.length, datasourceId]);

  // 数据源切换：重置筛选与分页并检索
  useEffect(() => {
    if (!datasourceId) {
      return;
    }
    setFilters(EMPTY_FILTERS);
    setHostPage(initialHostPage());
    setSelectedHost(undefined);
    setDrawerOpen(false);
    setProblemsOpen(false);
    setChartItem(undefined);
    searchHosts(EMPTY_FILTERS, initialHostPage());
  }, [datasourceId, searchHosts]);

  const handleSearch = () => {
    const page = initialHostPage();
    setHostPage(page);
    searchHosts(filters, page);
  };

  const handleReset = () => {
    const page = initialHostPage();
    setFilters(EMPTY_FILTERS);
    setHostPage(page);
    searchHosts(EMPTY_FILTERS, page);
  };

  const handleHostPageChange = (current: number, pageSize: number) => {
    const page = { current, pageSize };
    setHostPage(page);
    searchHosts(filters, page);
  };

  const handleSelectHost = (host: ZabbixHostSearchRow) => {
    setSelectedHost(host);
    setDrawerOpen(true);
  };

  const handleOpenProblems = (host: ZabbixHostSearchRow) => {
    setProblemsHost(host);
    setProblemsOpen(true);
  };

  if (zabbixDatasources.length === 0) {
    return (
      <PageLayout title='Zabbix 监控' icon={<span />}>
        <Empty style={{ padding: 48 }} description='尚未创建 Zabbix 数据源'>
          <Alert
            style={{ maxWidth: 520, textAlign: 'left' }}
            type='info'
            showIcon
            message='创建数据源'
            description='进入「系统配置 → 数据源」新建 Zabbix 数据源，填写 Zabbix 前端 JSON-RPC 地址（如 https://example.com/zabbix/api_jsonrpc.php）与账号密码，保存后回到本页。'
          />
        </Empty>
      </PageLayout>
    );
  }

  return (
    <PageLayout title='Zabbix 监控' icon={<span />}>
      <div className='n9e zabbix-host-page'>
        <QueryBar
          datasources={zabbixDatasources}
          datasourceId={datasourceId}
          onDatasourceChange={setDatasourceId}
          values={filters}
          onValuesChange={setFilters}
          onSearch={handleSearch}
          onReset={handleReset}
          searchLoading={hostLoading}
        />

        <div style={{ marginTop: 16 }}>
          <HostTable
            rows={hostResult?.list || []}
            total={hostResult?.total || 0}
            loading={hostLoading}
            current={hostPage.current}
            pageSize={hostPage.pageSize}
            onSelect={handleSelectHost}
            onOpenProblems={handleOpenProblems}
            onPageChange={handleHostPageChange}
          />
        </div>

        <LatestDataDrawer
          open={drawerOpen && !!selectedHost}
          host={selectedHost}
          datasourceId={datasourceId}
          onClose={() => setDrawerOpen(false)}
          onOpenChart={(row) => setChartItem(row)}
        />

        <ProblemsDrawer
          open={problemsOpen && !!problemsHost}
          host={problemsHost}
          datasourceId={datasourceId}
          onClose={() => setProblemsOpen(false)}
        />

        <ItemChartModal
          open={!!chartItem}
          item={chartItem}
          datasourceId={datasourceId}
          onClose={() => setChartItem(undefined)}
        />
      </div>
    </PageLayout>
  );
}
