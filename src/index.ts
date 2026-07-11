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
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ── Config ─────────────────────────────────────────────────────────────────

const API_BASE = (process.env.AGENTVISA_API_URL ?? "https://api.agentvisa.ai").replace(/\/$/, "");
const TOKEN_FILE = process.env.AGENTVISA_TOKEN_FILE ?? join(homedir(), ".agentvisa", "token");

/**
 * Resolve the permanent token LAZILY, on every tool call — never cached.
 * Env var wins (set at launch by the MCP config); otherwise the token file
 * is read fresh each time, so a token added or rotated while the agent is
 * running takes effect immediately, with no restart.
 */
function getAgentVisaToken(): string {
  const fromEnv = (process.env.AGENTVISA_TOKEN ?? "").trim();
  if (fromEnv) return fromEnv;
  try {
    return readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

if (!getAgentVisaToken()) {
  process.stderr.write(
    "[AgentVisa MCP] No token configured yet (checked AGENTVISA_TOKEN env and " +
    `${TOKEN_FILE}). That's OK — tools will work as soon as a token appears; ` +
    "no restart needed. Get one at https://agentvisa.ai\n"
  );
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "get_agentvisa_token",
    description:
      "Exchanges your permanent AgentVisa token for a short-lived TemporaryToken " +
      "authorised for a specific site. " +
      "Call this whenever a site returns HTTP 401 with the header 'X-AgentVisa-Required: <widget_id>'. " +
      "Pass that widget_id here. The returned temp_token should be sent as: " +
      "(a) 'X-AgentVisa-Token: <tmp>' header on standard sites, or " +
      "(b) 'AgentVisa-Assertion: <tmp>' header on sites using Web Bot Auth (RFC 9421) — " +
      "include 'agentvisa-assertion' in your Signature-Input covered components to bind it cryptographically. " +
      "The TemporaryToken expires in 60 minutes. Calling again while it is still valid returns the same token " +
      "(idempotent); a fresh one is issued automatically once it has expired or been revoked — safe to call any time. " +
      "Never display, log, or send the permanent token to any site — only the TemporaryToken.",
    inputSchema: {
      type: "object" as const,
      properties: {
        widget_id: {
          type: "string",
          description:
            "The widget ID from the site's 401 response header X-AgentVisa-Required. " +
            "Example: 'wgt_abc123'.",
        },
      },
      required: ["widget_id"],
    },
  },
  {
    name: "request_reverification",
    description:
      "Sends a re-verification email to the AgentVisa account holder. " +
      "Call this when a site returns reason='reverification_required', which means the " +
      "daily verification limit (300/day on Basic, 3000/day on Gold) has been reached. " +
      "The human must click the link in their email before the token can be used again. " +
      "Tell the user: 'Check your email for a re-verification link from AgentVisa.'",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_agentvisa_status",
    description:
      "Returns the current status of the AgentVisa MCP server: whether a token is " +
      "configured, the API URL in use, and the first 8 characters of the token so the " +
      "user can confirm which account is loaded. Also confirms Web Bot Auth (RFC 9421) " +
      "support via AgentVisa-Assertion header. Use this to diagnose setup issues.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "agentvisa", version: "0.4.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {

    // ── get_agentvisa_token ──────────────────────────────────────────────
    // Calls POST /v1/token/assert with the permanent api/token + widget_id
    // Returns the short-lived TemporaryToken for use with the site.
    case "get_agentvisa_token": {
      const AGENTVISA_TOKEN = getAgentVisaToken();
      if (!AGENTVISA_TOKEN) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "no_token_configured",
              message:
                "No AgentVisa token found (checked AGENTVISA_TOKEN env and " +
                `the token file ${TOKEN_FILE}). Have your human get one at ` +
                "https://agentvisa.ai/signup, then EITHER save it to that file " +
                "(no restart needed — retry this tool immediately after) OR add " +
                "it as AGENTVISA_TOKEN in the MCP config (takes effect after a restart).",
            }),
          }],
        };
      }

      const { widget_id } = args as { widget_id: string };

      if (!widget_id) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "missing_widget_id",
              message: "widget_id is required. Read it from the X-AgentVisa-Required header in the 401 response.",
            }),
          }],
        };
      }

      try {
        const response = await fetch(`${API_BASE}/v1/token/assert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: AGENTVISA_TOKEN,
            widget_id: widget_id,
          }),
        });

        const data = await response.json() as Record<string, unknown>;

        if (!response.ok) {
          // 429 — defensive: current servers assert idempotently (same token
          // returned while valid) and no longer emit a cooldown, but an older
          // or rate-limited server may still answer 429.
          if (response.status === 429) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: "rate_limited",
                  message:
                    "The AgentVisa API declined to issue a token right now (rate limited). " +
                    "If you still hold an unexpired temp_token for this site, retry with it; " +
                    "otherwise wait briefly and call this tool again.",
                  detail: data,
                }),
              }],
            };
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "assert_failed",
                http_status: response.status,
                detail: data,
              }),
            }],
          };
        }

        // Success — return the temp token
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              temp_token: data.temp_token,
              expires_at: data.expires_at,
              headers: {
                standard:     { "X-AgentVisa-Token": data.temp_token },
                web_bot_auth: { "AgentVisa-Assertion": data.temp_token },
              },
              instructions:
                "Send the temp_token as a header on your retry request to the site. " +
                "Standard sites: use 'X-AgentVisa-Token: <tmp>'. " +
                "Sites using Web Bot Auth (RFC 9421): use 'AgentVisa-Assertion: <tmp>' and " +
                "include 'agentvisa-assertion' in your Signature-Input covered components — " +
                "this cryptographically binds the human assertion to the signed request. " +
                "Do not log, display, or include this token in URLs. " +
                "Valid for 60 minutes for this site only.",
            }),
          }],
        };

      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "network_error",
              message: String(err),
            }),
          }],
        };
      }
    }

    // ── request_reverification ───────────────────────────────────────────
    case "request_reverification": {
      const AGENTVISA_TOKEN = getAgentVisaToken();
      if (!AGENTVISA_TOKEN) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ success: false, error: "no_token_configured" }),
          }],
        };
      }

      try {
        const response = await fetch(`${API_BASE}/v1/holder/reverify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-AgentVisa-Token": AGENTVISA_TOKEN,
          },
        });

        if (response.ok) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message:
                  "Re-verification email sent. Ask the user to check their email and click " +
                  "the link from AgentVisa. Once clicked, the daily limit resets and the " +
                  "token can be used again.",
              }),
            }],
          };
        }

        const data = await response.json() as Record<string, unknown>;
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              http_status: response.status,
              error: data,
            }),
          }],
        };

      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "network_error",
              message: String(err),
            }),
          }],
        };
      }
    }

    // ── get_agentvisa_status ─────────────────────────────────────────────
    case "get_agentvisa_status": {
      const AGENTVISA_TOKEN = getAgentVisaToken();
      const hasToken = Boolean(AGENTVISA_TOKEN);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            configured: hasToken,
            token_preview: hasToken ? `${AGENTVISA_TOKEN.slice(0, 8)}...` : null,
            api_url: API_BASE,
            server_version: "0.4.0",
          web_bot_auth_support: true,
          web_bot_auth_header: "AgentVisa-Assertion",
          }),
        }],
      };
    }

    default:
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "unknown_tool", tool: name }),
        }],
        isError: true,
      };
  }
});

// ── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[AgentVisa MCP] Server running\n");
}

main().catch((err) => {
  process.stderr.write(`[AgentVisa MCP] Fatal error: ${err}\n`);
  process.exit(1);
});
