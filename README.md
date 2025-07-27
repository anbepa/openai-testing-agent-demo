# Testing Agent Demo

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](frontend/LICENSE)

This monorepo demonstrates how you can use Google's Gemini API to generate Playwright test scripts from natural language descriptions. The backend sends the user prompt to Gemini and returns executable Playwright code.

The repo contains three applications that work together:

- **frontend** – Next.js web interface used to configure tests and watch them run.
- **gemini-server** – Node service that sends the instructions to Gemini and returns Playwright code.
- **sample-test-app** – Example e‑commerce site used as an example app to test by the agent.

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

   Edit each `.env.development` file and set `GOOGLE_API_KEY` with your Gemini credentials.

   ```bash
   cp frontend/.env.example frontend/.env.development
   cp gemini-server/.env.example gemini-server/.env.development
   cp sample-test-app/.env.example sample-test-app/.env.development
   ```

   The sample app also defines demo login credentials, which by default are:

   ```bash
   ADMIN_USERNAME=test_user_name
   ADMIN_PASSWORD=test_password
   ```

   Make sure you add a `sample-test-app/.env.development` file with the example credentials to run the demo.

3. **Install dependencies**

   ```bash
   npm install
   npx playwright install
   ```

4. **Run all apps**

   ```bash
   npm run dev
   ```

   This will start all three apps:

   - Frontend UI: http://localhost:3000
   - Sample app: http://localhost:3005
   - Gemini server: [ws://localhost:8000](http://localhost:8000)

   Navigate to [localhost:3000](http://localhost:3000) to see the frontend UI and run the demo.

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
