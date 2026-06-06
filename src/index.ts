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

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ── Config ─────────────────────────────────────────────────────────────────

const AGENTVISA_TOKEN = process.env.AGENTVISA_TOKEN ?? "";
const API_BASE = (process.env.AGENTVISA_API_URL ?? "https://api.agentvisa.ai").replace(/\/$/, "");

if (!AGENTVISA_TOKEN) {
  process.stderr.write(
    "[AgentVisa MCP] ERROR: AGENTVISA_TOKEN environment variable is not set.\n" +
    "Get your token at https://agentvisa.ai and add it to your MCP config.\n"
  );
}

// ── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "get_agentvisa_token",
    description:
      "Exchanges your permanent AgentVisa api/token for a short-lived TemporaryToken " +
      "authorised for a specific site. " +
      "Call this whenever a site returns HTTP 401 with the header 'X-AgentVisa-Required: <widget_id>'. " +
      "Pass that widget_id here. The returned temporary_token goes in the " +
      "'X-AgentVisa-Token' header on your retry request to the site. " +
      "The TemporaryToken expires in 60 minutes. A new one can only be issued once per 24 hours per site. " +
      "Never display, log, or send the permanent api/token to any site — only the TemporaryToken.",
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
      "daily verification limit (10/day on Basic, 50/day on Gold) has been reached. " +
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
      "Returns the current status of the AgentVisa MCP server: whether an api/token is " +
      "configured, the API URL in use, and the first 8 characters of the token so the " +
      "user can confirm which account is loaded. Use this to diagnose setup issues.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

// ── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "agentvisa", version: "0.2.0" },
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
      if (!AGENTVISA_TOKEN) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: "no_token_configured",
              message:
                "AGENTVISA_TOKEN is not set in the MCP server config. " +
                "Visit https://agentvisa.ai to get your api/token, then add it as " +
                "AGENTVISA_TOKEN in your MCP configuration.",
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
            agent_token_id: AGENTVISA_TOKEN,
            widget_id: widget_id,
            duration_minutes: 60,
          }),
        });

        const data = await response.json() as Record<string, unknown>;

        if (!response.ok) {
          // 429 = cooldown active — a valid TemporaryToken already exists for this widget
          if (response.status === 429) {
            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: "cooldown_active",
                  message:
                    "A TemporaryToken for this site was already issued within the last 24 hours. " +
                    "If a previous token has not yet expired (60-minute window), retry with it. " +
                    "Otherwise wait for the 24-hour cooldown to reset.",
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

        // Success — return the TemporaryToken
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              temporary_token: data.temporary_token,
              expires_at: data.expires_at,
              instructions:
                "Add this as the HTTP header 'X-AgentVisa-Token: <temporary_token>' " +
                "on your retry request to the site. " +
                "Do not log, display, or include in URLs. " +
                "This token is valid for 60 minutes for this site only.",
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
      const hasToken = Boolean(AGENTVISA_TOKEN);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            configured: hasToken,
            token_preview: hasToken ? `${AGENTVISA_TOKEN.slice(0, 8)}...` : null,
            api_url: API_BASE,
            server_version: "0.2.0",
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
