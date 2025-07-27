import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.development' });

const PORT = process.env.PORT || 8000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: CORS_ORIGIN } });

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  apiKey: process.env.GOOGLE_API_KEY,
});

app.get('/', (req, res) => {
  res.send('Gemini server with execution running');
});

// Create screenshots directory if it doesn't exist
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('testCaseInitiated', async (data) => {
    console.log('Received test case data:', data);

    socket.emit('message', '🤖 Generating test steps with Gemini...');

    // Build comprehensive prompt for generating test steps
    let prompt = `You are a QA automation assistant. Break down the following test case into clear, executable steps:

TEST INSTRUCTIONS:
${data.testCase}

TARGET WEBSITE: ${data.url}
LOGIN REQUIRED: ${data.loginRequired ? 'Yes' : 'No'}`;

    if (data.loginRequired) {
      prompt += `
USERNAME: ${data.userName}
PASSWORD: ${data.password}`;
    }

    if (data.userInfo) {
      const userInfo = JSON.parse(data.userInfo);
      prompt += `
USER INFO: Name: ${userInfo.name}, Email: ${userInfo.email}, Address: ${userInfo.address}`;
    }

    prompt += `

Please respond with a JSON array of test steps in this exact format:
[
  {
    "step_number": 1,
    "step_instructions": "Navigate to ${data.url}",
    "action_type": "navigate",
    "target": "${data.url}",
    "status": "pending"
  },
  {
    "step_number": 2,
    "step_instructions": "Wait for page to load",
    "action_type": "wait",
    "target": "networkidle",
    "status": "pending"
  }
]

IMPORTANT RULES:
1. For GitHub search, use selector: 'input[name="q"], [data-target="qbsearch-input.inputButtonText"]'
2. For typing, use format: "selector|text" in target field
3. For clicking search, use: 'button[type="submit"], .btn-primary'
4. For verification, use specific selectors like: '.search-results, [data-testid="results"]'
5. Action types: navigate, click, type, wait, screenshot, verify
6. Keep steps simple and use real CSS selectors for the target website
7. For ${data.url}, use GitHub-specific selectors`;

    try {
      const response = await model.invoke(prompt);
      let stepsText = response.content;

      // Extract JSON from markdown if present
      const jsonMatch = stepsText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) {
        stepsText = jsonMatch[1];
      }

      const steps = JSON.parse(stepsText);

      // Send initial steps to frontend
      socket.emit('testcases', JSON.stringify({ steps }));
      socket.emit('message', '✅ Test steps generated! Starting execution...');

      // Execute the test steps
      await executeTestSteps(steps, data, socket);

    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating test steps: ' + err.message);
    }
  });

  socket.on('message', async (msg) => {
    try {
      const response = await model.invoke(msg);
      socket.emit('message', response.content);
    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating response.');
    }
  });
});

// Function to execute test steps with Playwright
async function executeTestSteps(steps, testData, socket) {
  let browser = null;
  let page = null;

  try {
    socket.emit('message', '🚀 Starting browser...');

    // Launch browser
    browser = await chromium.launch({
      headless: false, // Show browser for debugging
      slowMo: 1000 // Slow down actions for visibility
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      try {
        socket.emit('message', `📋 Step ${step.step_number}: ${step.step_instructions}`);

        // Update step status to running
        step.status = 'running';
        socket.emit('testscriptupdate', JSON.stringify({ steps }));

        await executeStep(page, step, testData, socket);

        // Update step status to pass
        step.status = 'Pass';
        step.step_reasoning = 'Step completed successfully';

        // Take screenshot after each step
        const screenshotPath = `screenshots/step_${step.step_number}_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        step.image_path = screenshotPath;

        socket.emit('testscriptupdate', JSON.stringify({ steps }));
        socket.emit('message', `✅ Step ${step.step_number} completed`);

        // Wait between steps
        await page.waitForTimeout(2000);

      } catch (stepError) {
        console.error(`Step ${step.step_number} failed:`, stepError);

        step.status = 'Fail';
        step.step_reasoning = `Step failed: ${stepError.message}`;

        // Take screenshot of failure
        try {
          const screenshotPath = `screenshots/step_${step.step_number}_failed_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          step.image_path = screenshotPath;
        } catch (screenshotError) {
          console.error('Failed to take failure screenshot:', screenshotError);
        }

        socket.emit('testscriptupdate', JSON.stringify({ steps }));
        socket.emit('message', `❌ Step ${step.step_number} failed: ${stepError.message}`);

        // Continue with next step instead of stopping
        continue;
      }
    }

    const passedSteps = steps.filter(s => s.status === 'Pass').length;
    const totalSteps = steps.length;

    socket.emit('message', `🎉 Test completed! ${passedSteps}/${totalSteps} steps passed`);

  } catch (error) {
    console.error('Test execution error:', error);
    socket.emit('message', `❌ Test execution failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to execute individual step with smart selector handling
async function executeStep(page, step, testData, socket) {
  switch (step.action_type) {
    case 'navigate':
      await page.goto(step.target, { waitUntil: 'networkidle' });
      break;

    case 'wait':
      if (step.target === 'networkidle') {
        await page.waitForLoadState('networkidle');
      } else if (step.target.startsWith('selector:')) {
        const selector = step.target.replace('selector:', '');
        await page.waitForSelector(selector, { timeout: 10000 });
      } else {
        const timeout = parseInt(step.target) || 2000;
        await page.waitForTimeout(timeout);
      }
      break;

    case 'click':
      await clickWithSmartSelector(page, step.target);
      break;

    case 'type':
      await typeWithSmartSelector(page, step.target);
      break;

    case 'screenshot':
      const screenshotPath = `screenshots/manual_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      step.image_path = screenshotPath;
      break;

    case 'verify':
      await verifyWithSmartSelector(page, step.target);
      break;

    case 'login':
      // Handle login if credentials are provided
      if (testData.loginRequired) {
        await page.fill('input[type="text"], input[name*="user"], input[name*="email"]', testData.userName);
        await page.fill('input[type="password"], input[name*="pass"]', testData.password);
        await page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
        await page.waitForLoadState('networkidle');
      }
      break;

    default:
      socket.emit('message', `⚠️ Unknown action type: ${step.action_type}`);
  }
}

// Smart selector functions that try multiple selectors
async function clickWithSmartSelector(page, target) {
  const url = page.url();

  // GitHub-specific selectors
  if (url.includes('github.com')) {
    if (target.includes('search') || target.includes('input')) {
      const selectors = [
        'input[name="q"]',
        '[data-target="qbsearch-input.inputButtonText"]',
        '.js-site-search-focus',
        'input[placeholder*="Search"]',
        '.search-input'
      ];

      for (const selector of selectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          return;
        } catch (e) {
          continue;
        }
      }
    }

    if (target.includes('button') || target.includes('submit')) {
      const selectors = [
        'button[type="submit"]',
        '.btn-primary',
        'button:has-text("Search")',
        '[data-testid="search-button"]'
      ];

      for (const selector of selectors) {
        try {
          await page.click(selector, { timeout: 3000 });
          return;
        } catch (e) {
          continue;
        }
      }
    }
  }

  // Fallback to original target
  await page.click(target, { timeout: 10000 });
}

async function typeWithSmartSelector(page, target) {
  const url = page.url();
  let selector, text;

  if (target.includes('|')) {
    [selector, text] = target.split('|');
    selector = selector.trim();
    text = text.trim();
  } else {
    // If no pipe, assume it's just text for search
    text = target;
    selector = 'input[name="q"]'; // Default search selector
  }

  // GitHub-specific search input
  if (url.includes('github.com') && (selector.includes('search') || selector.includes('input'))) {
    const selectors = [
      'input[name="q"]',
      '[data-target="qbsearch-input.inputButtonText"]',
      '.js-site-search-focus',
      'input[placeholder*="Search"]',
      '.search-input'
    ];

    for (const searchSelector of selectors) {
      try {
        await page.fill(searchSelector, text, { timeout: 3000 });
        return;
      } catch (e) {
        continue;
      }
    }
  }

  // Fallback
  if (!text) {
    throw new Error(`Invalid type step format. Expected "selector|text", got: ${target}`);
  }
  await page.fill(selector, text);
}

async function verifyWithSmartSelector(page, target) {
  const url = page.url();

  // GitHub-specific verification
  if (url.includes('github.com') && target.includes('result')) {
    const selectors = [
      '.search-results',
      '[data-testid="results"]',
      '.repo-list',
      '.search-result-item',
      '.codesearch-results'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) return;
      } catch (e) {
        continue;
      }
    }
  }

  // Fallback verification
  const element = await page.$(target);
  if (!element) {
    throw new Error(`Element not found: ${target}`);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
