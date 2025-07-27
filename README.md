# Testing Agent Demo

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](frontend/LICENSE)

This monorepo demonstrates automated testing using AI agents. It offers two approaches:

1. **Gemini Hybrid**: Use Google's Gemini API to generate test steps AND automatically execute them with Playwright
2. **OpenAI CUA**: Use OpenAI's Computer Use Agent for advanced computer vision-based test execution

The repo contains four applications:

- **frontend** – Next.js web interface used to configure tests, specify target URLs, and watch execution
- **gemini-server** – Node service that uses Google Gemini to generate test steps and executes them automatically with Playwright
- **cua-server** – Node service that uses OpenAI CUA for advanced computer vision-based test execution
- **sample-test-app** – Optional example e‑commerce site for local testing demonstrations

![screenshot](./screenshot.jpg)

> [!CAUTION]  
> Computer use is in preview. Because the model is still in preview and may be susceptible to exploits and inadvertent mistakes, we discourage trusting it in authenticated environments or for high-stakes tasks.

## How to use

1. **Clone the repository**

   ```bash
   git clone https://github.com/openai/openai-testing-agent-demo
   cd openai-testing-agent-demo
   ```

2. **Prepare environment files**

   **Option A: Gemini Hybrid (Recommended)**
   ```bash
   cp frontend/.env.example frontend/.env.development
   cp gemini-server/.env.example gemini-server/.env.development
   ```
   Edit `gemini-server/.env.development` and add your `GOOGLE_API_KEY`.

   **Option B: Full Test Execution (OpenAI CUA)**
   ```bash
   cp frontend/.env.example frontend/.env.development
   cp cua-server/.env.example cua-server/.env.development
   ```
   Edit `cua-server/.env.development` and add your `OPENAI_API_KEY`.

   **Optional:** For local sample app testing:
   ```bash
   cp sample-test-app/.env.example sample-test-app/.env.development
   ```

3. **Install dependencies**

   ```bash
   npm install
   npx playwright install
   ```

4. **Run the testing agent**

   **Option A: Gemini Hybrid (Recommended)**
   ```bash
   npm run dev:frontend
   npm run dev:gemini-server
   ```

   **Option B: OpenAI CUA (Advanced)**
   ```bash
   npm run dev  # This runs frontend + cua-server by default
   ```

   **With sample app (either option):**
   ```bash
   npm run dev:with-sample
   ```

   This will start:
   - Frontend UI: http://localhost:3000
   - Backend server: ws://localhost:8000 (gemini-server OR cua-server)
   - Sample app (optional): http://localhost:3005

5. **Configure your test**

   Navigate to [localhost:3000](http://localhost:3000) and:
   - Enter the URL of the website you want to test
   - Describe what you want to test in natural language
   - Configure authentication if needed
   - Submit and watch the AI:
     - **Gemini**: Generate test steps and execute them automatically with Playwright
     - **CUA**: Execute tests with advanced computer vision and real browser automation

For details on each app see their READMEs:

- [frontend/README.md](frontend/README.md)
- [gemini-server/README.md](gemini-server/README.md)
- [sample-test-app/README.md](sample-test-app/README.md)

## Customization

You can use this testing agent with any web app you choose, and update the test case and target URL either in the config UI or in the `frontend/lib/constants.ts` file (default values used in the UI).

`sample-test-app` is only provided as an example to try the demo, and `frontend` as a testing interface. The core logic of the testing agent is in `gemini-server`, which is what you might want to bring into your own application.

## Contributing

You are welcome to open issues or submit PRs to improve this app, however, please note that we may not review all suggestions.

## Security Notes

- This project is meant to be used on test environments only.
- Do not use real user data in production.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
