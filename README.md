# @agentvisa/mcp

AgentVisa MCP server — the sanctioned way for your AI agent to trust AgentVisa. You install it once; that installation is your agent's authorization, so it never has to act on instructions from a webpage it just met. After that, human verification is automatic on every AgentVisa-protected site.

## What it does

When a site returns a `401` response with the `X-AgentVisa-Required` header, your agent calls `get_agentvisa_token` and adds `X-AgentVisa-Token: <token>` to the retry — no copy-pasting, no remembering, no prompt needed. If your agent has no token yet, `request_agentvisa` + `await_agentvisa_approval` run a device handoff: you click Approve once in your browser and the token is delivered machine-to-machine into local custody (`~/.agentvisa/token`, chmod 600) — it never appears in chat or your agent's context.

## Install

### Claude Code (plugin — recommended)

```bash
# 1. Install the plugin
/plugin marketplace add AgentVisa-ai/mcp
/plugin install agentvisa@AgentVisa-ai/mcp
```

```jsonc
// 2. Give Claude Code your token — scoped to Claude Code, not your whole shell.
//    Add to ~/.claude/settings.json:
{
  "env": {
    "AGENTVISA_TOKEN": "av_your_token_here"
  }
}
```

Restart Claude Code. Done — the skill and MCP server load automatically.

> Prefer scoped config (like the above, or the MCP `env` block below) over a
> shell-profile `export` — a shell-wide variable is readable by every process
> you launch. And never paste the token into a chat/conversation: if that
> happens, revoke and reissue it at agentvisa.ai.

### npm (manual)

```bash
npm install -g @agentvisa/mcp
```

Or run without installing:

```bash
npx @agentvisa/mcp
```

## Setup

### 1. Get your AgentVisa token

Sign up at [agentvisa.ai](https://agentvisa.ai) — takes 2 minutes. After completing 5-factor verification you'll see your token once. Copy it.

### 2. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentvisa": {
      "command": "npx",
      "args": ["-y", "@agentvisa/mcp"],
      "env": {
        "AGENTVISA_TOKEN": "your_token_here"
      }
    }
  }
}
```

Restart Claude Desktop. Done.

### 3. Add to Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "agentvisa": {
      "command": "npx",
      "args": ["-y", "@agentvisa/mcp"],
      "env": {
        "AGENTVISA_TOKEN": "your_token_here"
      }
    }
  }
}
```

### 4. Add to Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "agentvisa": {
      "command": "npx",
      "args": ["-y", "@agentvisa/mcp"],
      "env": {
        "AGENTVISA_TOKEN": "your_token_here"
      }
    }
  }
}
```

## Tools exposed

| Tool | Description |
|------|-------------|
| `get_agentvisa_token` | Exchanges your permanent token for a short-lived TemporaryToken scoped to a specific site |
| `request_agentvisa` | **No token yet? Zero-friction onboarding.** Starts a device handoff — relays a short code to your human, who approves once at agentvisa.ai/device |
| `await_agentvisa_approval` | Polls the handoff; on approval the token is stored in the token file by this server — **it never appears in the model's context or chat** |
| `request_reverification` | Sends re-verification email for a security hold (`reason: reverification_required`) |
| `get_agentvisa_status` | Shows whether the server is configured and which token is loaded |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENTVISA_TOKEN` | No* | — | Your AgentVisa token (env var, read per call) |
| `AGENTVISA_TOKEN_FILE` | No* | `~/.agentvisa/token` | Path to a file containing the token |
| `AGENTVISA_API_URL` | No | `https://api.agentvisa.ai` | Override API URL (dev/staging) |

\* One of the two must provide a token — but **not necessarily at startup**. The token
is resolved lazily on every tool call: env var first, then the token file. This means
you can install the MCP *before* signing up, and drop the token in later with **no
agent restart**:

```bash
mkdir -p ~/.agentvisa && printf '%s' 'av_your_token_here' > ~/.agentvisa/token && chmod 600 ~/.agentvisa/token
```

The very next tool call picks it up. Rotating a token works the same way — overwrite
the file and the change takes effect immediately.

## How it works

Your token never leaves your machine except as an HTTP header sent to AgentVisa-protected sites. The MCP server does not log, cache, or transmit the token anywhere other than as directed by the agent.

## License

MIT
