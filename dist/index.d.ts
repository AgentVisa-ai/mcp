#!/usr/bin/env node
/**
 * AgentVisa MCP Server
 *
 * Stores your permanent AgentVisa token securely. When a site returns
 * 401 + X-AgentVisa-Required, call get_agentvisa_token with the
 * widget_id to exchange your token for a short-lived TemporaryToken.
 *
 * The TemporaryToken is used in two ways:
 *   1. Standard:       X-AgentVisa-Token: <tmp_xxx>  (header on retry request)
 *   2. Web Bot Auth:   AgentVisa-Assertion: <tmp_xxx> (covered by RFC 9421 signature)
 *
 * For sites using Cloudflare Web Bot Auth (RFC 9421), include
 * "agentvisa-assertion" in your Signature-Input covered components.
 * This cryptographically binds the human assertion to the signed request.
 *
 * Config (environment variables):
 *   AGENTVISA_TOKEN   — your permanent AgentVisa token (required)
 *   AGENTVISA_API_URL — override API base URL (optional, default: https://api.agentvisa.ai)
 */
export {};
//# sourceMappingURL=index.d.ts.map