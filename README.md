# @agentvisa/mcp

AgentVisa MCP server — install once in your AI agent and it handles human verification automatically on any AgentVisa-protected site.

## What it does

When a site returns a `401` response with the `X-AgentVisa-Required` header, your agent calls `get_agentvisa_token` and adds `X-AgentVisa-Token: <token>` to the retry — no copy-pasting, no remembering, no prompt needed.

## Install

### Claude Code (plugin — recommended)

```bash
# 1. Add your token to your shell profile (~/.zshrc or ~/.bashrc)
export AGENTVISA_TOKEN="av_your_token_here"

# 2. Install the plugin
/plugin marketplace add AgentVisa-ai/mcp
/plugin install agentvisa@AgentVisa-ai/mcp
```

Restart Claude Code. Done — the skill and MCP server load automatically.

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
| `request_reverification` | Sends re-verification email when daily limit is hit (`reason: reverification_required`) |
| `get_agentvisa_status` | Shows whether the server is configured and which token is loaded |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENTVISA_TOKEN` | ✅ Yes | — | Your AgentVisa token |
| `AGENTVISA_API_URL` | No | `https://api.agentvisa.ai` | Override API URL (dev/staging) |

## How it works

Your token never leaves your machine except as an HTTP header sent to AgentVisa-protected sites. The MCP server does not log, cache, or transmit the token anywhere other than as directed by the agent.

## License

MIT
