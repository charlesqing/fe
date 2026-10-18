export default {
  query_type: {
    problem: 'Проблемы',
    event: 'Все события',
  },
  severity: {
    0: 'Не классифицировано',
    1: 'Информация',
    2: 'Предупреждение',
    3: 'Средняя',
    4: 'Высокая',
    5: 'Критическая',
  },
  form: {
    hosts_placeholder: 'Выберите хосты',
    severities_placeholder: 'Выберите важность',
    limit: 'Лимит',
  },
  export: {
    button: 'Экспорт',
    csv: 'CSV',
    xlsx: 'XLSX',
    json: 'JSON',
    no_data: 'Нет данных для экспорта',
    success: 'Экспорт выполнен',
    failed: 'Ошибка экспорта',
  },
  empty: {
    execute_first: 'Настройте условия запроса и нажмите «Выполнить»',
  },
  rule: {
    hosts_placeholder: 'Выберите хосты',
    items_placeholder: 'Выберите элементы (сначала хосты)',
    items_required: 'Выберите элементы',
    add_query: 'Добавить запрос',
  },
};
