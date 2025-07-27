import { GeminiCLIExecutor } from '../lib/GeminiCLIExecutor.js';
import { MCPConfigManager } from '../lib/MCPConfigManager.js';
import fs from 'fs';
import path from 'path';

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running GeminiCLIExecutor tests...\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

const runner = new TestRunner();

// Test Gemini CLI installation check
runner.test('should check Gemini CLI installation', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);

  const installationStatus = await executor.checkGeminiCLIInstallation();
  
  if (typeof installationStatus.available !== 'boolean') {
    throw new Error('Installation check should return availability status');
  }

  console.log(`   Gemini CLI available: ${installationStatus.available} (${installationStatus.method || 'not found'})`);
});

// Test environment setup
runner.test('should setup Gemini environment', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  await mcpManager.ensureConfiguration();
  
  const executor = new GeminiCLIExecutor(mcpManager);
  
  // Mock environment variable
  process.env.GOOGLE_API_KEY = 'test-api-key';
  
  const environment = await executor.setupGeminiEnvironment();
  
  if (!environment.settingsPath) {
    throw new Error('Environment should include settings path');
  }
  
  if (!environment.environment.GEMINI_API_KEY) {
    throw new Error('Environment should include API key');
  }
  
  // Check if settings file was created
  if (!fs.existsSync(environment.settingsPath)) {
    throw new Error('Gemini settings file should be created');
  }
  
  const settings = JSON.parse(fs.readFileSync(environment.settingsPath, 'utf8'));
  if (!settings.mcpServers) {
    throw new Error('Settings should include MCP servers configuration');
  }
  
  console.log(`   Settings created at: ${environment.settingsPath}`);
});

// Test prompt building
runner.test('should build comprehensive test prompt', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);

  const testData = {
    testCase: 'Search for a repository on GitHub',
    url: 'https://github.com',
    loginRequired: false
  };

  const prompt = executor.buildTestPrompt(testData);
  
  if (!prompt.includes('TEST CASE:')) {
    throw new Error('Prompt should include test case section');
  }
  
  if (!prompt.includes('browser_navigate')) {
    throw new Error('Prompt should mention MCP tools');
  }
  
  if (!prompt.includes(testData.url)) {
    throw new Error('Prompt should include target URL');
  }
  
  console.log(`   Prompt length: ${prompt.length} characters`);
});

// Test prompt building with login
runner.test('should build prompt with login information', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);

  const testData = {
    testCase: 'Login and check dashboard',
    url: 'https://example.com',
    loginRequired: true,
    userName: 'testuser',
    password: 'testpass',
    userInfo: JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
      address: '123 Test St'
    })
  };

  const prompt = executor.buildTestPrompt(testData);
  
  if (!prompt.includes('LOGIN REQUIRED: Yes')) {
    throw new Error('Prompt should indicate login is required');
  }
  
  if (!prompt.includes('USERNAME: testuser')) {
    throw new Error('Prompt should include username');
  }
  
  if (!prompt.includes('USER INFO:')) {
    throw new Error('Prompt should include user info');
  }
  
  console.log(`   Login prompt includes credentials and user info`);
});

// Test output parsing
runner.test('should parse Gemini CLI output', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);

  const mockOutput = `Starting test execution...
browser_navigate to https://github.com
Navigation completed successfully
browser_click on search input
Click completed successfully
browser_type "test repository"
Typing completed successfully
browser_take_screenshot saved to screenshot_1.png
Screenshot saved successfully
Test completed with success`;

  const parsed = executor.parseGeminiOutput(mockOutput);
  
  if (!Array.isArray(parsed.steps)) {
    throw new Error('Parsed output should include steps array');
  }
  
  if (parsed.steps.length === 0) {
    throw new Error('Should parse at least one step');
  }
  
  const navigateStep = parsed.steps.find(s => s.mcp_tool_used === 'browser_navigate');
  if (!navigateStep) {
    throw new Error('Should parse browser_navigate step');
  }
  
  if (parsed.screenshots.length === 0) {
    throw new Error('Should parse screenshot paths');
  }
  
  console.log(`   Parsed ${parsed.steps.length} steps and ${parsed.screenshots.length} screenshots`);
});

// Test termination
runner.test('should handle process termination', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);

  // Should not throw when no process is running
  executor.terminate();
  
  console.log(`   Termination handled gracefully`);
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runner };