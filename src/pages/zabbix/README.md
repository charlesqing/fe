# Zabbix 主机查询页 — 设计文档

路由 `/zabbix/query`，菜单位置：「Zabbix 监控 → 监控查询」（权限点 `/zabbix/query`）。

参照 Zabbix「监测 > 主机」的主从交互流重构（2026-10-18）：**筛选 → 主机列表 → 最新数据抽屉 → 单监控项趋势图**，替代早期的四步骤纵向卡片流。

## 1. 组件结构

```
src/pages/zabbix/
├── index.tsx            # 页面容器：筛选/分页/选中主机/图表项 状态提升
├── index.less           # 选中行高亮等页面级样式
├── constants.ts         # 分页默认值、状态/类型映射、筛选预设、色板
├── services.ts          # API 封装（唯一出口）：host-search / hostgroups / latest-data / ds-query
├── utils.ts             # 纯函数：分页 / 值与单位人性化 / 变化量 / 相对时间 / series 工具
├── utils.test.ts        # 纯函数单测（22 例）
├── QueryBar/            # 筛选栏：数据源 / 主机名称 / IP / 状态 / 主机群组 + 版本状态 Tag
├── HostTable/           # 主机列表：接口可用性、主机组、问题数徽标；点击行打开抽屉
├── LatestData/          # 最新数据抽屉：搜索 + 筛选预设 + 自动刷新 + 图形入口
└── ItemChartModal/      # 单监控项趋势图弹窗：TimeRangePicker + UPlotChart + 统计摘要
```

## 2. 交互与状态约定

- **筛选栏**：名称/IP 为子串匹配（后端内存过滤）；主机组随数据源加载一次，失败降级为空不阻塞；数据源旁展示上游 Zabbix 版本 Tag 作连通性提示。
- **主机列表**：服务端分页（host.get 无法按 IP 服务端过滤，后端拉取上限内清单后内存过滤分页）；问题数 > 0 用红色 Badge 突出，点击直接进抽屉。
- **最新数据抽屉**：关键词本地高亮 + 服务端筛选预设（数值型/文本/不支持/禁用）；自动刷新定时器在抽屉关闭或换主机时清理；只有 value_type 0/3 提供图形入口，其余展示"不可出图"及原因。
- **趋势图弹窗**：复用通用 `/ds-query` 通道（窗口 > 3 天后端自动切换 trend.get 小时聚合）；图表走平台 UPlotChart 管线（`getDataFrameAndBaseSeries` 对齐 + `seriesBuider`/`axisBuilder`/`tooltipPlugin`）；顶部展示最新/平均/最小/最大。

## 3. 数据链路

前端 services → n9e 路由（`/api/n9e/zabbix-host-search`、`/zabbix-hostgroups`、`/zabbix-latest-data`、`/ds-query`）→ `datasource/zabbix` → `dskit/zabbix` JSON-RPC → Zabbix `api_jsonrpc.php`。

- 最新值人性化（B→GB、bps→Kbps）在前端完成，后端只回原始字符串与值映射结果（`lastvalue_display`）。
- 变化量 = lastvalue − prevvalue（后端计算），前端只负责 ▲/▼ 着色（增红减绿）。
- 检查时间 `lastclock` 为 unix 秒，前端做相对时间展示与精确时间 Tooltip。

## 4. ⚠️ 陷阱备忘

- antd 4.21：Modal/Drawer 用 `visible`（不是 `open`），`Descriptions` 不支持 `items` prop，`Badge` 无 `onClick`（需包一层 span）。
- Zabbix `problem.get`/`event.get` 不支持 `selectHosts`；时间参数是 `time_from`/`time_till`（不是 `time_to`）。
- `apiinfo.version` 必须不带 `auth` 参数调用。
- lodash 的 `_.map(objArray, 'name')` 在本仓库 tsconfig 下会命中错误重载，直接用 `.map()`。
