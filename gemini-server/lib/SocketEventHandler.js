import { ProgressTracker } from "./ProgressTracker.js";
/**
 * Socket.IO event handler with backward compatibility
 */
export class SocketEventHandler {
  constructor(mcpConfigManager, geminiCLIExecutor, errorHandler, model) {
    this.mcpConfigManager = mcpConfigManager;
    this.geminiCLIExecutor = geminiCLIExecutor;
    this.model = model;
    this.errorHandler = errorHandler;
    this.activeConnections = new Map();
  }

  /**
   * Handles new socket connections
   */
  handleConnection(socket) {
    console.log(`Client connected: ${socket.id}`);
    
    // Store connection info
    this.activeConnections.set(socket.id, {
      connectedAt: new Date(),
      lastActivity: new Date(),
      testCasesExecuted: 0
    });

    // Set up event handlers
    this.setupEventHandlers(socket);

    // Send welcome message
    socket.emit('message', '🔗 Connected to Gemini Testing Server');
    socket.emit('message', `🎭 Integration mode: ${process.env.USE_MCP_INTEGRATION === 'true' ? 'Gemini CLI + MCP' : 'Legacy Playwright'}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Sets up all event handlers for a socket
   */
  setupEventHandlers(socket) {
    // Main test case execution handler
    socket.on('testCaseInitiated', async (data) => {
      await this.handleTestCaseInitiated(socket, data);
    });

    // General message handler
    socket.on('message', async (msg) => {
      await this.handleMessage(socket, msg);
    });

    // Legacy event handlers for backward compatibility
    socket.on('executeTest', async (data) => {
      console.log('⚠️ Legacy event "executeTest" received, mapping to "testCaseInitiated"');
      await this.handleTestCaseInitiated(socket, data);
    });

    socket.on('chat', async (msg) => {
      console.log('⚠️ Legacy event "chat" received, mapping to "message"');
      await this.handleMessage(socket, msg);
    });

    // Status and health check handlers
    socket.on('getStatus', () => {
      this.handleGetStatus(socket);
    });

    socket.on('getCapabilities', () => {
      this.handleGetCapabilities(socket);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
      socket.emit('message', `❌ Socket error: ${error.message}`);
    });
  }

  /**
   * Handles test case initiation with enhanced error handling
   */
  async handleTestCaseInitiated(socket, data) {
    try {
      // Update connection activity
      this.updateConnectionActivity(socket.id);

      console.log(`Test case initiated by ${socket.id}:`, data);

      // Validate input data
      const validationResult = this.validateTestCaseData(data);
      if (!validationResult.valid) {
        socket.emit('message', `❌ Invalid test data: ${validationResult.error}`);
        return;
      }

      // Check if we should use the new Gemini CLI + MCP integration
      if (process.env.USE_MCP_INTEGRATION === 'true') {
        await this.executeWithGeminiCLI(socket, data);
      } else {
        await this.executeWithLegacyPlaywright(socket, data);
    }
    } catch (error) {
      console.error('Test case initiation error:', error);
      socket.emit('message', `❌ ${error.message}`);
    }
  }

  async handleMessage(socket, msg) {
    try {
      // Use Gemini CLI when MCP integration is enabled
      if (process.env.USE_MCP_INTEGRATION === 'true') {
        const testData = { testCase: msg, url: 'about:blank', loginRequired: false };
        const tracker = new ProgressTracker(socket);
        const progress = (type, data) => {
          if (type === 'output') tracker.onGeminiOutput(data);
          else if (type === 'error') tracker.onError(data);
        };
        await this.geminiCLIExecutor.executeTestCase(testData, progress);
        tracker.sendFinalSummary();
      } else if (this.model) {
        const response = await this.model.invoke(msg);
        socket.emit('message', response.content);
      } else {
        socket.emit('message', '⚠️ Legacy mode requires @langchain/google-genai. Enable MCP integration with USE_MCP_INTEGRATION=true');
      }
    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating response.');
    }
  }

  async executeWithGeminiCLI(socket, data) {
    try {
      socket.emit('message', '🤖 Starting Gemini CLI with MCP integration...');

      const installationStatus = await this.geminiCLIExecutor.checkGeminiCLIInstallation();
      if (!installationStatus.available) {
        socket.emit('message', '📦 Installing Gemini CLI...');
        await this.geminiCLIExecutor.installGeminiCLI();
      }

      socket.emit('message', '🔧 Setting up MCP environment...');

      const tracker = new ProgressTracker(socket);
      const progressCallback = (type, d) => {
        if (type === 'output') tracker.onGeminiOutput(d);
        else if (type === 'error') tracker.onError(d);
      };

      const result = await this.geminiCLIExecutor.executeTestCase(data, progressCallback);
      this.geminiCLIExecutor.parseGeminiOutput(result.output);
      tracker.sendFinalSummary();
    } catch (error) {
      console.error('Gemini CLI execution error:', error);
      const recovery = await this.errorHandler.handleGeminiCLIError(error, { testData: data });
      if (recovery.recovered && recovery.retry) {
        socket.emit('message', `🔄 Attempting recovery: ${recovery.message}`);
        return await this.executeWithGeminiCLI(socket, data);
      }
      socket.emit('message', `❌ Gemini CLI execution failed: ${error.message}`);
      if (recovery.suggestion) {
        socket.emit('message', `💡 Suggestion: ${recovery.suggestion}`);
      }
      throw error;
    }
  }

  async executeWithLegacyPlaywright(socket, data) {
    try {
      socket.emit('message', '🤖 Generating test steps with Gemini...');

      let prompt = `You are a QA automation assistant. Break down the following test case into clear, executable steps:\n\nTEST INSTRUCTIONS:\n${data.testCase}\n\nTARGET WEBSITE: ${data.url}\nLOGIN REQUIRED: ${data.loginRequired ? 'Yes' : 'No'}`;
      if (data.loginRequired) {
        prompt += `\nUSERNAME: ${data.userName}\nPASSWORD: ${data.password}`;
      }
      if (data.userInfo) {
        const userInfo = JSON.parse(data.userInfo);
        prompt += `\nUSER INFO: Name: ${userInfo.name}, Email: ${userInfo.email}, Address: ${userInfo.address}`;
      }
      prompt += `\n\nPlease respond with a JSON array of test steps in this exact format:\n[ { "step_number": 1, "step_instructions": "Navigate to ${data.url}", "action_type": "navigate", "target": "${data.url}", "status": "pending" } ]`;

      const response = await this.model.invoke(prompt);
      let stepsText = response.content;
      const jsonMatch = stepsText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
      if (jsonMatch) stepsText = jsonMatch[1];
      const steps = JSON.parse(stepsText);
      socket.emit('testcases', JSON.stringify({ steps }));
      socket.emit('message', '✅ Test steps generated! Starting execution...');
      await this.executeTestSteps(steps, data, socket);
    } catch (err) {
      console.error('Gemini error', err);
      socket.emit('message', 'Error generating test steps: ' + err.message);
    }
  }

  async executeTestSteps(steps, testData, socket) {
    console.log('⚠️ Using legacy Playwright execution. Consider enabling USE_MCP_INTEGRATION=true for better performance');
    let browser = null;
    let page = null;
    try {
      const { chromium } = await import('playwright');
      socket.emit('message', '🚀 Starting browser...');
      browser = await chromium.launch({ headless: false, slowMo: 1000 });
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      page = await context.newPage();
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        try {
          socket.emit('message', `📋 Step ${step.step_number}: ${step.step_instructions}`);
          step.status = 'running';
          socket.emit('testscriptupdate', JSON.stringify({ steps }));
          await this.executeStep(page, step, testData, socket);
          step.status = 'Pass';
          step.step_reasoning = 'Step completed successfully';
          const screenshotPath = `screenshots/step_${step.step_number}_${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath });
          step.image_path = screenshotPath;
          socket.emit('testscriptupdate', JSON.stringify({ steps }));
          socket.emit('message', `✅ Step ${step.step_number} completed`);
          await page.waitForTimeout(2000);
        } catch (stepError) {
          console.error(`Step ${step.step_number} failed:`, stepError);
          step.status = 'Fail';
          step.step_reasoning = `Step failed: ${stepError.message}`;
          try {
            const screenshotPath = `screenshots/step_${step.step_number}_failed_${Date.now()}.png`;
            await page.screenshot({ path: screenshotPath });
            step.image_path = screenshotPath;
          } catch {}
          socket.emit('testscriptupdate', JSON.stringify({ steps }));
          socket.emit('message', `❌ Step ${step.step_number} failed: ${stepError.message}`);
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
      if (browser) await browser.close();
    }
  }

  async executeStep(page, step, testData, socket) {
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
        await this.clickWithSmartSelector(page, step.target);
        break;
      case 'type':
        await this.typeWithSmartSelector(page, step.target);
        break;
      case 'screenshot':
        const screenshotPath = `screenshots/manual_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        step.image_path = screenshotPath;
        break;
      case 'verify':
        await this.verifyWithSmartSelector(page, step.target);
        break;
      case 'login':
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

  async clickWithSmartSelector(page, target) {
    const url = page.url();
    if (url.includes('github.com')) {
      if (target.includes('search') || target.includes('input')) {
        const selectors = ['input[name="q"]', '[data-target="qbsearch-input.inputButtonText"]', '.js-site-search-focus', 'input[placeholder*="Search"]', '.search-input'];
        for (const selector of selectors) {
          try { await page.click(selector, { timeout: 3000 }); return; } catch {}
        }
      }
      if (target.includes('button') || target.includes('submit')) {
        const selectors = ['button[type="submit"]', '.btn-primary', 'button:has-text("Search")', '[data-testid="search-button"]'];
        for (const selector of selectors) {
          try { await page.click(selector, { timeout: 3000 }); return; } catch {}
        }
      }
    }
    await page.click(target, { timeout: 10000 });
  }

  async typeWithSmartSelector(page, target) {
    const url = page.url();
    let selector, text;
    if (target.includes('|')) {
      [selector, text] = target.split('|');
      selector = selector.trim();
      text = text.trim();
    } else {
      text = target;
      selector = 'input[name="q"]';
    }
    if (url.includes('github.com') && (selector.includes('search') || selector.includes('input'))) {
      const selectors = ['input[name="q"]', '[data-target="qbsearch-input.inputButtonText"]', '.js-site-search-focus', 'input[placeholder*="Search"]', '.search-input'];
      for (const s of selectors) {
        try { await page.fill(s, text, { timeout: 3000 }); return; } catch {}
      }
    }
    if (!text) throw new Error(`Invalid type step format. Expected "selector|text", got: ${target}`);
    await page.fill(selector, text);
  }

  async verifyWithSmartSelector(page, target) {
    const url = page.url();
    if (url.includes('github.com') && target.includes('result')) {
      const selectors = ['.search-results', '[data-testid="results"]', '.repo-list', '.search-result-item', '.codesearch-results'];
      for (const selector of selectors) {
        try { const element = await page.$(selector); if (element) return; } catch {}
      }
    }
    const element = await page.$(target);
    if (!element) throw new Error(`Element not found: ${target}`);
  }

  updateConnectionActivity(id) {
    const info = this.activeConnections.get(id);
    if (info) info.lastActivity = new Date();
  }

  handleDisconnection(socket) {
    this.activeConnections.delete(socket.id);
    console.log(`Client disconnected: ${socket.id}`);
  }

  handleGetStatus(socket) {
    socket.emit('status', { activeConnections: this.activeConnections.size });
  }

  handleGetCapabilities(socket) {
    socket.emit('capabilities', {
      mcpIntegration: process.env.USE_MCP_INTEGRATION === 'true',
      tools: 24
    });
  }

  validateTestCaseData(data) {
    if (!data || !data.testCase || !data.url) {
      return { valid: false, error: 'Missing testCase or url' };
    }
    return { valid: true };
  }
}
