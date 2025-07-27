import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TestStepParser } from './TestStepParser.js';
import { MCPToolsHelper } from './MCPToolsHelper.js';
import { ErrorHandler } from './ErrorHandler.js';

export class GeminiCLIExecutor {
  constructor(mcpConfigManager) {
    this.mcpConfigManager = mcpConfigManager;
    this.geminiProcess = null;
    this.stepParser = new TestStepParser();
    this.mcpToolsHelper = new MCPToolsHelper();
    this.errorHandler = new ErrorHandler(mcpConfigManager, this);
  }

  /**
   * Executes a test case using Gemini CLI with MCP integration
   */
  async executeTestCase(testData, progressCallback) {
    try {
      console.log('🤖 Starting Gemini CLI test execution...');
      
      // Ensure MCP server is running
      await this.mcpConfigManager.validateConnection();
      
      // Setup Gemini environment
      const environment = await this.setupGeminiEnvironment();
      
      // Build comprehensive test prompt
      const prompt = this.buildTestPrompt(testData);
      
      // Execute Gemini CLI with MCP tools
      const result = await this.runGeminiCLI(prompt, environment, progressCallback);
      
      return result;
      
    } catch (error) {
      console.error('❌ Gemini CLI execution failed:', error);
      
      // Try to handle and recover from the error
      const recovery = await this.errorHandler.handleGeminiCLIError(error, { testData });
      
      if (recovery.recovered && recovery.retry) {
        console.log(`🔄 Attempting recovery: ${recovery.message}`);
        // Retry the execution
        return await this.executeTestCase(testData, progressCallback);
      }
      
      throw new Error(`Gemini CLI execution failed: ${error.message}. ${recovery.suggestion || ''}`);
    }
  }

  /**
   * Sets up the environment for Gemini CLI with MCP integration
   */
  async setupGeminiEnvironment() {
    const mcpConfig = this.mcpConfigManager.getConfig();
    
    // Create Gemini settings directory if it doesn't exist
    const geminiDir = path.join(process.cwd(), '.gemini');
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }

    // Create Gemini CLI settings with MCP configuration
    const geminiSettings = {
      model: 'gemini-2.0-flash',
      apiKey: process.env.GOOGLE_API_KEY,
      mcpServers: mcpConfig.mcpServers,
      systemPrompt: `You are a QA automation assistant with access to Playwright MCP tools for browser automation.

Available MCP Tools:
- browser_navigate: Navigate to a URL
- browser_click: Click on elements
- browser_type: Type text into elements  
- browser_wait_for: Wait for conditions
- browser_take_screenshot: Capture screenshots
- browser_snapshot: Get accessibility snapshot
- browser_console_messages: Get console logs
- browser_network_requests: Get network activity
- browser_close: Close browser
- browser_hover: Hover over elements
- browser_drag: Drag and drop
- browser_file_upload: Upload files
- browser_handle_dialog: Handle dialogs
- browser_press_key: Press keyboard keys
- browser_resize: Resize browser window
- browser_select_option: Select dropdown options
- browser_tab_new: Open new tab
- browser_tab_select: Switch tabs
- browser_tab_close: Close tab
- browser_tab_list: List tabs

Use these tools to execute test steps. Always provide step-by-step progress updates.

ADVANCED CAPABILITIES:
- Use browser_drag for drag and drop interactions
- Use browser_hover for hover effects and tooltips
- Use browser_file_upload for file upload scenarios
- Use browser_tab_new, browser_tab_select, browser_tab_close for multi-tab workflows
- Use browser_snapshot instead of screenshots for accessibility-based element detection
- Use browser_console_messages and browser_network_requests for debugging
- Use browser_handle_dialog for alert/confirm/prompt dialogs
- Use browser_press_key for keyboard shortcuts and special keys
- Use browser_select_option for dropdown selections
- Use browser_resize for responsive testing

BEST PRACTICES:
- Always use browser_snapshot before interacting with elements to understand page structure
- Use browser_wait_for with specific conditions rather than fixed timeouts
- Capture browser_console_messages when errors occur for better debugging
- Monitor browser_network_requests for API calls and resource loading
- Take browser_take_screenshot after major actions for visual verification`
    };

    const settingsPath = path.join(geminiDir, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(geminiSettings, null, 2));

    return {
      settingsPath,
      environment: {
        ...process.env,
        GEMINI_API_KEY: process.env.GOOGLE_API_KEY,
        MCP_CONFIG_PATH: this.mcpConfigManager.configPath
      }
    };
  }

  /**
   * Builds a comprehensive test prompt with MCP tool context
   */
  buildTestPrompt(testData) {
    let prompt = `Execute the following test case using Playwright MCP tools:

TEST CASE: ${testData.testCase}
TARGET WEBSITE: ${testData.url}
LOGIN REQUIRED: ${testData.loginRequired ? 'Yes' : 'No'}`;

    if (testData.loginRequired) {
      prompt += `
USERNAME: ${testData.userName}
PASSWORD: ${testData.password}`;
    }

    if (testData.userInfo) {
      const userInfo = JSON.parse(testData.userInfo);
      prompt += `
USER INFO: Name: ${userInfo.name}, Email: ${userInfo.email}, Address: ${userInfo.address}`;
    }

    prompt += `

INSTRUCTIONS:
1. Start with browser_navigate to go to the target website
2. Use browser_snapshot to understand the page structure and accessibility tree
3. Use appropriate MCP tools based on the test requirements:
   - browser_click for button/link interactions
   - browser_type for text input
   - browser_hover for hover effects
   - browser_drag for drag and drop
   - browser_file_upload for file uploads
   - browser_select_option for dropdowns
   - browser_handle_dialog for alerts/confirms
   - browser_press_key for keyboard shortcuts
4. For multi-tab scenarios, use browser_tab_new, browser_tab_select, browser_tab_close
5. Use browser_wait_for with specific conditions (text, element, network idle)
6. Take browser_take_screenshot after major actions for visual verification
7. Use browser_console_messages to capture JavaScript errors and logs
8. Use browser_network_requests to monitor API calls and resource loading
9. Handle errors gracefully and provide detailed error information
10. Use browser_resize for responsive testing if needed

ACCESSIBILITY FOCUS:
- Prefer browser_snapshot over screenshots for element detection
- Use semantic selectors and ARIA attributes when possible
- Verify accessibility compliance during interactions

Execute the test step by step and provide real-time updates on progress.

ENHANCED SCENARIO GUIDANCE:
${this.mcpToolsHelper.getEnhancedInstructions(testData.testCase).join('\n')}

BEST PRACTICES:
${this.mcpToolsHelper.getBestPractices().join('\n')}`;

    return prompt;
  }

  /**
   * Runs Gemini CLI with the given prompt and environment
   */
  async runGeminiCLI(prompt, environment, progressCallback) {
    return new Promise((resolve, reject) => {
      const args = ['-p', prompt];
      
      if (environment.settingsPath && fs.existsSync(environment.settingsPath)) {
        args.push('--settings', environment.settingsPath);
      }

      // Check if gemini CLI is available globally
      let cmd = 'gemini';
      let finalArgs = args;

      const check = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
      if (check.error) {
        // Fallback to npx
        cmd = 'npx';
        finalArgs = ['@google/gemini-cli', ...args];
      }

      console.log(`🚀 Executing: ${cmd} ${finalArgs.join(' ')}`);

      this.geminiProcess = spawn(cmd, finalArgs, {
        env: environment.environment,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let outputBuffer = '';
      let errorBuffer = '';

      // Handle stdout - this contains the main output and MCP tool interactions
      this.geminiProcess.stdout.on('data', (chunk) => {
        const data = chunk.toString();
        outputBuffer += data;
        
        // Send real-time progress updates
        if (progressCallback) {
          progressCallback('output', data);
        }
        
        console.log('Gemini CLI output:', data);
      });

      // Handle stderr - this contains errors and debug info
      this.geminiProcess.stderr.on('data', (chunk) => {
        const data = chunk.toString();
        errorBuffer += data;
        
        if (progressCallback) {
          progressCallback('error', data);
        }
        
        console.error('Gemini CLI error:', data);
      });

      // Handle process completion
      this.geminiProcess.on('close', (code) => {
        this.geminiProcess = null;
        
        if (code === 0) {
          console.log('✅ Gemini CLI execution completed successfully');
          resolve({
            success: true,
            output: outputBuffer,
            error: errorBuffer,
            exitCode: code
          });
        } else {
          console.error(`❌ Gemini CLI exited with code ${code}`);
          reject(new Error(`Gemini CLI exited with code ${code}. Error: ${errorBuffer}`));
        }
      });

      // Handle process errors
      this.geminiProcess.on('error', async (error) => {
        this.geminiProcess = null;
        console.error('❌ Gemini CLI process error:', error);
        
        // Try to handle the error
        const recovery = await this.errorHandler.handleGeminiCLIError(error, { type: 'process_error' });
        
        if (recovery.recovered) {
          console.log(`🔄 Process error recovery: ${recovery.message}`);
        }
        
        reject(new Error(`Gemini CLI process error: ${error.message}. ${recovery.suggestion || ''}`));
      });

      // Set a timeout for long-running processes
      const timeout = setTimeout(async () => {
        if (this.geminiProcess) {
          console.log('⏰ Gemini CLI execution timeout, terminating...');
          this.geminiProcess.kill('SIGTERM');
          
          // Handle timeout error
          try {
            const timeoutError = new Error('Gemini CLI execution timeout');
            const recovery = await this.errorHandler.handleGeminiCLIError(timeoutError, { type: 'timeout' });
            reject(new Error(`Gemini CLI execution timeout. ${recovery.suggestion || ''}`));
          } catch (recoveryError) {
            reject(new Error('Gemini CLI execution timeout'));
          }
        }
      }, 300000); // 5 minutes timeout

      this.geminiProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Parses Gemini CLI output to extract structured information
   */
  parseGeminiOutput(output) {
    // Use the enhanced TestStepParser for better parsing
    const parsed = this.stepParser.parseStepsFromOutput(output);
    
    // Map MCP tools to frontend-compatible format
    const mappedSteps = this.stepParser.mapMCPToolsToSteps(parsed.steps);
    
    return {
      steps: mappedSteps,
      screenshots: parsed.screenshots,
      errors: parsed.errors,
      consoleMessages: parsed.consoleMessages,
      networkRequests: parsed.networkRequests,
      rawOutput: output
    };
  }

  /**
   * Checks if Gemini CLI is installed and available
   */
  async checkGeminiCLIInstallation() {
    try {
      const result = spawnSync('gemini', ['--version'], { stdio: 'pipe' });
      if (result.error) {
        // Try with npx
        const npxResult = spawnSync('npx', ['@google/gemini-cli', '--version'], { stdio: 'pipe' });
        if (npxResult.error) {
          throw new Error('Gemini CLI not found');
        }
        return { available: true, method: 'npx' };
      }
      return { available: true, method: 'global' };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Installs Gemini CLI if not available
   */
  async installGeminiCLI() {
    console.log('📦 Installing @google/gemini-cli...');
    
    return new Promise((resolve, reject) => {
      const installProcess = spawn('npm', ['install', '-g', '@google/gemini-cli'], {
        stdio: 'inherit'
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Gemini CLI installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install Gemini CLI, exit code: ${code}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(new Error(`Failed to install Gemini CLI: ${error.message}`));
      });
    });
  }

  /**
   * Terminates any running Gemini CLI process
   */
  terminate() {
    if (this.geminiProcess) {
      console.log('🛑 Terminating Gemini CLI process...');
      this.geminiProcess.kill('SIGTERM');
      this.geminiProcess = null;
    }
  }
}