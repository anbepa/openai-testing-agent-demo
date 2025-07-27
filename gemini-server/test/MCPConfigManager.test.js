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
    console.log('🧪 Running MCPConfigManager tests...\n');

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

// Test configuration creation
runner.test('should create default configuration', async () => {
  const testConfigPath = '.test-mcp-config.json';
  const manager = new MCPConfigManager(testConfigPath);

  // Clean up any existing test file
  if (fs.existsSync(testConfigPath)) {
    fs.unlinkSync(testConfigPath);
  }

  await manager.ensureConfiguration();

  if (!fs.existsSync(testConfigPath)) {
    throw new Error('Configuration file was not created');
  }

  const config = manager.loadConfig();
  if (!config.mcpServers || !config.mcpServers.playwright) {
    throw new Error('Invalid configuration structure');
  }

  // Cleanup
  fs.unlinkSync(testConfigPath);
});

// Test configuration validation
runner.test('should validate configuration structure', async () => {
  const manager = new MCPConfigManager();

  const validConfig = {
    mcpServers: {
      playwright: {
        command: "npx",
        args: ["@playwright/mcp@latest"],
        disabled: false
      }
    }
  };

  // Should not throw
  manager.validateConfig(validConfig);

  const invalidConfig = {
    mcpServers: {}
  };

  try {
    manager.validateConfig(invalidConfig);
    throw new Error('Should have thrown validation error');
  } catch (error) {
    if (!error.message.includes('missing playwright server')) {
      throw error;
    }
  }
});

// Test default configuration structure
runner.test('should provide valid default configuration', async () => {
  const manager = new MCPConfigManager();
  const defaultConfig = manager.getDefaultConfig();

  manager.validateConfig(defaultConfig);

  const playwrightConfig = defaultConfig.mcpServers.playwright;
  if (!Array.isArray(playwrightConfig.autoApprove)) {
    throw new Error('autoApprove should be an array');
  }

  if (playwrightConfig.autoApprove.length === 0) {
    throw new Error('autoApprove should contain default tools');
  }
});

// Test configuration loading
runner.test('should load existing configuration', async () => {
  const manager = new MCPConfigManager('../.kiro/settings/mcp.json');
  
  const config = manager.loadConfig();
  manager.validateConfig(config);

  if (!config.mcpServers.playwright.autoApprove.includes('browser_navigate')) {
    throw new Error('Default configuration should include browser_navigate in autoApprove');
  }
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runner };