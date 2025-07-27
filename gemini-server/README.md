# Gemini Server

This simple Express service connects to the Gemini API via LangChain and exposes a Socket.IO WebSocket API used by the frontend.

### New: Using Gemini CLI with Playwright MCP

You can optionally execute tests using the [Gemini CLI](https://github.com/google-gemini/gemini-cli) and [Playwright MCP](https://github.com/microsoft/playwright-mcp).
Install the CLI globally if you haven't already:

```bash
npm install -g @google/gemini-cli
```

Create a `.gemini/settings.json` file in the project root with the following configuration:

```json
{
  "model": "gemini-2.0-flash",
  "apiKey": "$GOOGLE_API_KEY",
  "tools": {
    "mcpServers": {
      "playwright": {
        "command": "npx",
        "args": ["@playwright/mcp@latest"]
      }
    }
  }
}
```

Run the server with `USE_GEMINI_CLI=true` to enable CLI-based execution.

## Setup

1. Copy the example environment file and add your Gemini key:
   ```bash
   cp .env.example .env.development
   # edit .env.development
   ```
2. Install dependencies and launch the server:
   ```bash
   npm install
   npm run dev
   ```
   The server listens on port `8000` by default. Set `PORT` to change it.

### Environment Variables

- `GOOGLE_API_KEY` – required for calls to Gemini.
- `PORT` (optional) – WebSocket port (default `8000`).
- `CORS_ORIGIN` (optional) – allowed CORS origin for incoming connections.
