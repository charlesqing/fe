export default {
  query_type: {
    problem: 'Problems',
    event: 'All events',
  },
  severity: {
    0: 'Not classified',
    1: 'Information',
    2: 'Warning',
    3: 'Average',
    4: 'High',
    5: 'Disaster',
  },
  form: {
    hosts_placeholder: 'Select hosts',
    severities_placeholder: 'Select severities',
    limit: 'Limit',
  },
  export: {
    button: 'Export',
    csv: 'CSV',
    xlsx: 'XLSX',
    json: 'JSON',
    no_data: 'No data to export',
    success: 'Export succeeded',
    failed: 'Export failed',
  },
  empty: {
    execute_first: 'Configure the query and click "Query"',
  },
  rule: {
    hosts_placeholder: 'Select hosts',
    items_placeholder: 'Select items (pick hosts first)',
    items_required: 'Please select items',
    add_query: 'Add query',
  },
};
