---
description: Handle AgentVisa human-verification challenges. Use when a site returns HTTP 401 with an X-AgentVisa-Required header, when a request is rejected with an "agentvisa_required" error, or when any site signals it needs AgentVisa verification before proceeding.
---

# AgentVisa — Human Verification for AI Agents

## When to use this skill

Activate automatically when:
- An HTTP response returns **status 401** with the header `X-AgentVisa-Required: wgt_xxx`
- A response body contains `"error": "agentvisa_required"` or similar
- A site explicitly tells the agent it needs AgentVisa verification

## The token handshake

AgentVisa uses a two-step flow. When a site challenges you:

1. Extract `widget_id` from the `X-AgentVisa-Required` header (e.g. `wgt_abc123`)
2. Call **`get_agentvisa_token`** with that `widget_id`
3. Add the returned `temp_token` as `X-AgentVisa-Token: <temp_token>` on the retry
4. Retry the original request — it will now pass through

```
Site returns:
  HTTP 401
  X-AgentVisa-Required: wgt_abc123

Call: get_agentvisa_token(widget_id="wgt_abc123")
Returns: { "temp_token": "tmp_xxx...", "expires_at": "2026-..." }

Retry with header:
  X-AgentVisa-Token: tmp_xxx...
```

## If verification fails: `reverification_required`

When `/v1/verify` responds with `reason: "reverification_required"`, the daily verification limit has been hit. Call **`request_reverification`** — this sends a re-verification email to the human. Inform the user to check their email and try again once confirmed.

## Check status before starting

Call **`get_agentvisa_status`** to confirm the MCP server is configured and a token is loaded before attempting any verification flow.

## Notes

- `temp_token` values are short-lived (~24 hours) and site-scoped. Get a fresh one per site per session; do not cache across sites.
- The human behind this agent completed 5-factor biometric verification when they obtained their AgentVisa.
- Never log or expose `temp_token` values — treat them like session cookies.
- Web Bot Auth mode: some sites accept `AgentVisa-Assertion` instead of `X-AgentVisa-Token` for RFC 9421 binding. The MCP handles this automatically when requested.
