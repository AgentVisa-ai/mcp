# Contributing to @agentvisa/mcp

Thank you for your interest in contributing to the AgentVisa MCP server!

## How to Contribute

1. **Fork** the repository and clone it locally.
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes.
4. Build and test:
   ```bash
   npm run build
   node dist/index.js  # should print "[AgentVisa MCP] Server running"
   ```
5. Submit a **Pull Request** with a clear description of the change.

## Code Guidelines

- Keep the MCP server dependency-free beyond `@modelcontextprotocol/sdk`.
- New tools must follow the existing response shape (`{ success, ... }`).
- The permanent `AGENTVISA_TOKEN` must never appear in logs, responses, or tool output — only the first 8 characters in `get_agentvisa_status`.
- Update `README.md` when adding or changing tools.
- All contributions must be licensed under the MIT License.

## Reporting Issues

Please open an issue on GitHub with:
- A clear description of the problem
- Your Node.js version and OS
- The MCP host you're using (Claude Desktop, Cursor, Windsurf, etc.)
- Expected vs actual behavior

Thank you for helping improve AgentVisa!
