export default {
  query_type: {
    problem: '问题事件',
    event: '全部事件',
  },
  severity: {
    0: '未分类',
    1: '信息',
    2: '警告',
    3: '平均',
    4: '严重',
    5: '灾难',
  },
  form: {
    hosts_placeholder: '选择主机（可多选）',
    severities_placeholder: '选择严重级别',
    limit: '条数',
  },
  export: {
    button: '导出',
    csv: 'CSV',
    xlsx: 'XLSX',
    json: 'JSON',
    no_data: '没有可导出的数据',
    success: '导出成功',
    failed: '导出失败',
  },
  empty: {
    execute_first: '请配置查询条件并点击「查询」',
  },
  rule: {
    hosts_placeholder: '选择主机（可多选）',
    items_placeholder: '选择监控项（先选主机）',
    items_required: '请选择监控项',
    add_query: '添加查询',
  },
};
