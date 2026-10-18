export default {
  query_type: {
    problem: '問題イベント',
    event: '全イベント',
  },
  severity: {
    0: '未分類',
    1: '情報',
    2: '警告',
    3: '軽度',
    4: '重度',
    5: '致命的',
  },
  form: {
    hosts_placeholder: 'ホストを選択（複数可）',
    severities_placeholder: '重要度を選択',
    limit: '件数',
  },
  export: {
    button: 'エクスポート',
    csv: 'CSV',
    xlsx: 'XLSX',
    json: 'JSON',
    no_data: 'エクスポートするデータがありません',
    success: 'エクスポートに成功しました',
    failed: 'エクスポートに失敗しました',
  },
  empty: {
    execute_first: 'クエリ条件を設定して「実行」をクリックしてください',
  },
  rule: {
    hosts_placeholder: 'ホストを選択（複数可）',
    items_placeholder: 'アイテムを選択（先にホストを選択）',
    items_required: 'アイテムを選択してください',
    add_query: 'クエリを追加',
  },
};
