export const NS = 'ai-config-mcp-servers';
export const PATH = '/ai-config/mcp-servers';
export const PERM = PATH;

// 后端对非空 header 值的遮蔽占位（models/mcp_server.go 的 mcpSecretMask）。
// 编辑表单里出现该值即表示「未修改」，保存时后端保留库中原值。
export const HEADERS_MASK = '********';
