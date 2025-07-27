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
When enabled, Gemini CLI communicates with the Playwright MCP server and exposes
the following tools for browser automation:

- `browser_click` – Click on a web page element
- `browser_close` – Close the current page
- `browser_console_messages` – Get console log entries
- `browser_drag` – Perform drag and drop
- `browser_evaluate` – Evaluate JavaScript
- `browser_file_upload` – Upload files
- `browser_handle_dialog` – Interact with dialogs
- `browser_hover` – Hover over an element
- `browser_install` – Install a browser
- `browser_navigate` – Navigate to a URL
- `browser_navigate_back` – Go back in history
- `browser_navigate_forward` – Go forward in history
- `browser_network_requests` – List network requests
- `browser_press_key` – Press a keyboard key
- `browser_resize` – Resize the window
- `browser_select_option` – Select from a dropdown
- `browser_snapshot` – Accessibility snapshot of the page
- `browser_tab_close` – Close a tab
- `browser_tab_list` – List open tabs
- `browser_tab_new` – Open a new tab
- `browser_tab_select` – Switch tabs
- `browser_take_screenshot` – Capture a screenshot
- `browser_type` – Type into an input
- `browser_wait_for` – Wait for text or time

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
