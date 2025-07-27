# Gemini Server

This simple Express service connects to the Gemini API via LangChain and exposes a Socket.IO WebSocket API used by the frontend.

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
