export default {
  query_type: {
    problem: '問題事件',
    event: '全部事件',
  },
  severity: {
    0: '未分類',
    1: '信息',
    2: '警告',
    3: '平均',
    4: '嚴重',
    5: '災難',
  },
  form: {
    hosts_placeholder: '選擇主機（可多選）',
    severities_placeholder: '選擇嚴重級別',
    limit: '條數',
  },
  export: {
    button: '導出',
    csv: 'CSV',
    xlsx: 'XLSX',
    json: 'JSON',
    no_data: '沒有可導出的數據',
    success: '導出成功',
    failed: '導出失敗',
  },
  empty: {
    execute_first: '請配置查詢條件並點擊「查詢」',
  },
  rule: {
    hosts_placeholder: '選擇主機（可多選）',
    items_placeholder: '選擇監控項（先選主機）',
    items_required: '請選擇監控項',
    add_query: '添加查詢',
  },
};
