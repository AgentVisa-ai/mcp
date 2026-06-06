#!/usr/bin/env node
/**
 * AgentVisa MCP Server
 *
 * Stores your permanent api/token securely. When a site returns
 * 401 + X-AgentVisa-Required, call get_agentvisa_token with the
 * widget_id to exchange your api/token for a short-lived TemporaryToken.
 * Send that TemporaryToken as X-AgentVisa-Token on the retry.
 *
 * Config (environment variables):
 *   AGENTVISA_TOKEN   — your permanent AgentVisa api/token (required)
 *   AGENTVISA_API_URL — override API base URL (optional, default: https://api.agentvisa.ai)
 */
export {};
//# sourceMappingURL=index.d.ts.map