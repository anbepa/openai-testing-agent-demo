import { TestStepParser } from '../lib/TestStepParser.js';

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
    console.log('🧪 Running TestStepParser tests...\n');

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

// Test basic step parsing
runner.test('should parse basic MCP tool calls', async () => {
  const parser = new TestStepParser();
  
  const output = `Starting test execution...
Calling browser_navigate with url="https://github.com"
Navigation completed successfully
Calling browser_click with selector="input[name='q']"
Click completed successfully
Calling browser_type with selector="input[name='q']" text="test repository"
Typing completed successfully`;

  const result = parser.parseStepsFromOutput(output);
  
  if (!Array.isArray(result.steps)) {
    throw new Error('Should return steps array');
  }
  
  if (result.steps.length !== 3) {
    throw new Error(`Expected 3 steps, got ${result.steps.length}`);
  }
  
  const navigateStep = result.steps[0];
  if (navigateStep.mcp_tool_used !== 'browser_navigate') {
    throw new Error('First step should be browser_navigate');
  }
  
  if (navigateStep.action_type !== 'navigate') {
    throw new Error('Action type should be mapped correctly');
  }
  
  console.log(`   Parsed ${result.steps.length} steps successfully`);
});

// Test screenshot extraction
runner.test('should extract screenshot paths', async () => {
  const parser = new TestStepParser();
  
  const output = `Executing browser_take_screenshot
Screenshot saved to test_screenshot_1.png
Continuing with next step
Image captured as step_2_screenshot.png
Test completed`;

  const result = parser.parseStepsFromOutput(output);
  
  if (result.screenshots.length !== 2) {
    throw new Error(`Expected 2 screenshots, got ${result.screenshots.length}`);
  }
  
  if (!result.screenshots.includes('test_screenshot_1.png')) {
    throw new Error('Should include first screenshot path');
  }
  
  console.log(`   Extracted ${result.screenshots.length} screenshot paths`);
});

// Test error detection
runner.test('should detect errors and failures', async () => {
  const parser = new TestStepParser();
  
  const output = `Calling browser_click with selector="button"
Error: Element not found
Calling browser_type with text="hello"
Failed to locate input field
Calling browser_navigate with url="https://example.com"
Navigation completed successfully`;

  const result = parser.parseStepsFromOutput(output);
  
  if (result.errors.length !== 2) {
    throw new Error(`Expected 2 errors, got ${result.errors.length}`);
  }
  
  const failedSteps = result.steps.filter(s => s.status === 'Fail');
  if (failedSteps.length !== 2) {
    throw new Error(`Expected 2 failed steps, got ${failedSteps.length}`);
  }
  
  console.log(`   Detected ${result.errors.length} errors correctly`);
});

// Test step validation
runner.test('should validate step format', async () => {
  const parser = new TestStepParser();
  
  const validStep = {
    step_number: 1,
    step_instructions: 'Navigate to website',
    status: 'Pass'
  };
  
  const invalidStep = {
    step_number: 'invalid',
    step_instructions: '',
    status: 'unknown'
  };
  
  if (!parser.validateStepFormat(validStep)) {
    throw new Error('Valid step should pass validation');
  }
  
  if (parser.validateStepFormat(invalidStep)) {
    throw new Error('Invalid step should fail validation');
  }
  
  console.log('   Step validation works correctly');
});

// Test MCP tool mapping
runner.test('should map MCP tools to action types', async () => {
  const parser = new TestStepParser();
  
  const steps = [
    { mcp_tool_used: 'browser_navigate', step_number: 1, step_instructions: 'test', status: 'Pass' },
    { mcp_tool_used: 'browser_click', step_number: 2, step_instructions: 'test', status: 'Pass' },
    { mcp_tool_used: 'browser_type', step_number: 3, step_instructions: 'test', status: 'Pass' }
  ];
  
  const mapped = parser.mapMCPToolsToSteps(steps);
  
  if (mapped[0].action_type !== 'navigate') {
    throw new Error('browser_navigate should map to navigate');
  }
  
  if (mapped[1].action_type !== 'click') {
    throw new Error('browser_click should map to click');
  }
  
  if (mapped[2].action_type !== 'type') {
    throw new Error('browser_type should map to type');
  }
  
  console.log('   MCP tool mapping works correctly');
});

// Test parameter parsing
runner.test('should parse tool parameters', async () => {
  const parser = new TestStepParser();
  
  // Test JSON format
  const jsonParams = '{"url": "https://example.com", "timeout": 5000}';
  const parsedJson = parser.parseToolParameters(jsonParams);
  
  if (parsedJson.url !== 'https://example.com') {
    throw new Error('Should parse JSON parameters correctly');
  }
  
  // Test key=value format
  const kvParams = 'selector="input[name=q]", text="search term"';
  const parsedKv = parser.parseToolParameters(kvParams);
  
  if (parsedKv.selector !== 'input[name=q]') {
    throw new Error('Should parse key=value parameters correctly');
  }
  
  console.log('   Parameter parsing works for both JSON and key=value formats');
});

// Test instruction inference
runner.test('should infer MCP tools from instructions', async () => {
  const parser = new TestStepParser();
  
  const testCases = [
    { instruction: 'Navigate to https://github.com', expected: 'browser_navigate' },
    { instruction: 'Click on the search button', expected: 'browser_click' },
    { instruction: 'Type "hello world" in the input', expected: 'browser_type' },
    { instruction: 'Wait for page to load', expected: 'browser_wait_for' },
    { instruction: 'Take a screenshot', expected: 'browser_take_screenshot' },
    { instruction: 'Verify element exists', expected: 'browser_snapshot' }
  ];
  
  for (const testCase of testCases) {
    const inferred = parser.inferMCPTool(testCase.instruction);
    if (inferred !== testCase.expected) {
      throw new Error(`Expected ${testCase.expected} for "${testCase.instruction}", got ${inferred}`);
    }
  }
  
  console.log(`   Correctly inferred MCP tools for ${testCases.length} test cases`);
});

// Test target extraction from parameters
runner.test('should extract target from parameters', async () => {
  const parser = new TestStepParser();
  
  const testCases = [
    { params: { url: 'https://example.com' }, expected: 'https://example.com' },
    { params: { selector: 'button.submit' }, expected: 'button.submit' },
    { params: { text: 'hello world' }, expected: 'hello world' },
    { params: { element: 'input[type=text]' }, expected: 'input[type=text]' },
    { params: {}, expected: '' }
  ];
  
  for (const testCase of testCases) {
    const extracted = parser.extractTargetFromParameters(testCase.params);
    if (extracted !== testCase.expected) {
      throw new Error(`Expected "${testCase.expected}", got "${extracted}"`);
    }
  }
  
  console.log('   Target extraction from parameters works correctly');
});

// Test complex output parsing
runner.test('should parse complex real-world output', async () => {
  const parser = new TestStepParser();
  
  const complexOutput = `Starting test execution for GitHub search...
Step 1: Navigate to GitHub
Calling browser_navigate with {"url": "https://github.com", "waitUntil": "networkidle"}
Navigation completed successfully
Screenshot saved to step_1_navigate.png

Step 2: Find search input
Calling browser_snapshot to analyze page structure
Page snapshot captured
Calling browser_click with selector="input[name='q']"
Click completed successfully

Step 3: Enter search term
Calling browser_type with selector="input[name='q']", text="testing framework"
Typing completed successfully
Console message: Input value changed to "testing framework"

Step 4: Submit search
Calling browser_click with selector="button[type='submit']"
Error: Button not found, trying alternative selector
Calling browser_click with selector=".btn-primary"
Click completed successfully
Screenshot saved to step_4_search_results.png

Network request: GET https://github.com/search?q=testing+framework
Test execution completed with 3 successful steps and 1 retry`;

  const result = parser.parseStepsFromOutput(complexOutput);
  
  if (result.steps.length < 4) {
    throw new Error(`Expected at least 4 steps, got ${result.steps.length}`);
  }
  
  if (result.screenshots.length !== 2) {
    throw new Error(`Expected 2 screenshots, got ${result.screenshots.length}`);
  }
  
  if (result.errors.length !== 1) {
    throw new Error(`Expected 1 error, got ${result.errors.length}`);
  }
  
  if (result.consoleMessages.length !== 1) {
    throw new Error(`Expected 1 console message, got ${result.consoleMessages.length}`);
  }
  
  if (result.networkRequests.length !== 1) {
    throw new Error(`Expected 1 network request, got ${result.networkRequests.length}`);
  }
  
  console.log(`   Parsed complex output: ${result.steps.length} steps, ${result.screenshots.length} screenshots, ${result.errors.length} errors`);
});

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runner };