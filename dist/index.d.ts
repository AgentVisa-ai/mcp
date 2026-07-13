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
 * Config:
 *   AGENTVISA_TOKEN      — your permanent AgentVisa token (env var)
 *   AGENTVISA_TOKEN_FILE — path to a file containing the token (optional;
 *                          default ~/.agentvisa/token). The file is read on
 *                          EVERY call, so you can install this MCP once with
 *                          no token and drop the token file in later — no
 *                          agent restart needed. chmod 600 the file.
 *   AGENTVISA_API_URL    — override API base URL (optional, default: https://api.agentvisa.ai)
 *   AGENTVISA_WAIT_SECONDS — how long await_agentvisa_approval blocks waiting for
 *                          the human (default 240, max 600). Agents are turn-based:
 *                          holding the call open means the turn resumes the instant
 *                          the human approves, with no prompting.
 */
export {};
//# sourceMappingURL=index.d.ts.map