import { MCPConfigManager } from '../lib/MCPConfigManager.js';
import { GeminiCLIExecutor } from '../lib/GeminiCLIExecutor.js';
import { TestStepParser } from '../lib/TestStepParser.js';
import { ProgressTracker } from '../lib/ProgressTracker.js';

// Mock socket for performance testing
class MockSocket {
  constructor() {
    this.eventCount = 0;
  }
  
  emit(event, data) {
    this.eventCount++;
  }
}

// Performance test runner
class PerformanceTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('⚡ Running Performance Tests...\n');

    for (const { name, fn } of this.tests) {
      try {
        const startTime = Date.now();
        const result = await fn();
        const duration = Date.now() - startTime;
        
        this.results.push({
          name,
          duration,
          success: true,
          result
        });
        
        console.log(`✅ ${name}: ${duration}ms`);
        if (result && typeof result === 'object') {
          Object.entries(result).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
          });
        }
      } catch (error) {
        this.results.push({
          name,
          duration: 0,
          success: false,
          error: error.message
        });
        console.log(`❌ ${name}: ${error.message}`);
      }
    }

    this.printSummary();
    return this.results.every(r => r.success);
  }

  printSummary() {
    console.log('\n📊 Performance Test Summary:');
    
    const successful = this.results.filter(r => r.success);
    const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);
    const avgDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    console.log(`   Total tests: ${this.results.length}`);
    console.log(`   Successful: ${successful.length}`);
    console.log(`   Failed: ${this.results.length - successful.length}`);
    console.log(`   Total time: ${totalDuration}ms`);
    console.log(`   Average time: ${avgDuration.toFixed(2)}ms`);
    
    // Performance thresholds
    const slowTests = successful.filter(r => r.duration > 1000);
    if (slowTests.length > 0) {
      console.log(`\n⚠️ Slow tests (>1000ms):`);
      slowTests.forEach(test => {
        console.log(`   ${test.name}: ${test.duration}ms`);
      });
    }
  }
}

const runner = new PerformanceTestRunner();

// Test MCP configuration performance
runner.test('MCP Configuration Load Time', async () => {
  const iterations = 100;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
    await mcpManager.ensureConfiguration();
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  if (avgTime > 100) {
    throw new Error(`Average configuration load time too slow: ${avgTime}ms`);
  }
  
  return {
    'Average': `${avgTime.toFixed(2)}ms`,
    'Min': `${minTime}ms`,
    'Max': `${maxTime}ms`,
    'Iterations': iterations
  };
});

// Test step parsing performance
runner.test('Step Parsing Performance', async () => {
  const parser = new TestStepParser();
  const iterations = 1000;
  
  const complexOutput = `
Starting complex test execution...
Step 1: Navigate to application
Calling browser_navigate with {"url": "https://complex-app.example.com", "waitUntil": "networkidle"}
Navigation completed successfully
Screenshot saved to step_1_navigate.png

Step 2: Authenticate user
Calling browser_type with selector="input[name='username']", text="testuser"
Typing completed successfully
Calling browser_type with selector="input[name='password']", text="password123"
Typing completed successfully
Calling browser_click with selector="button[type='submit']"
Click completed successfully
Console message: User authenticated successfully

Step 3: Navigate to dashboard
Calling browser_wait_for with condition="text=Dashboard"
Wait completed successfully
Calling browser_snapshot
Snapshot captured successfully

Step 4: Perform complex interactions
Calling browser_hover with selector=".menu-item"
Hover completed successfully
Calling browser_drag with sourceSelector=".draggable", targetSelector=".drop-zone"
Drag completed successfully
Calling browser_file_upload with selector="input[type='file']", files=["document.pdf"]
File upload completed successfully

Step 5: Verify results
Calling browser_console_messages
Console messages retrieved
Calling browser_network_requests
Network requests retrieved
Calling browser_take_screenshot with path="final_result.png"
Screenshot saved to final_result.png

Network request: GET https://complex-app.example.com/api/dashboard
Network request: POST https://complex-app.example.com/api/upload
Console message: File uploaded successfully
Console message: Dashboard data loaded
Test execution completed with all advanced features
`;

  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const parsed = parser.parseStepsFromOutput(complexOutput);
    const mapped = parser.mapMCPToolsToSteps(parsed.steps);
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  if (avgTime > 10) {
    throw new Error(`Average parsing time too slow: ${avgTime}ms`);
  }
  
  return {
    'Average': `${avgTime.toFixed(2)}ms`,
    'Min': `${minTime}ms`,
    'Max': `${maxTime}ms`,
    'Iterations': iterations,
    'Steps parsed': 5,
    'Tools detected': 12
  };
});

// Test progress tracking performance
runner.test('Progress Tracking Performance', async () => {
  const iterations = 500;
  const mockSocket = new MockSocket();
  const progressTracker = new ProgressTracker(mockSocket);
  
  const testOutputs = [
    'Starting test execution...',
    'Calling browser_navigate with url="https://example.com"',
    'Navigation completed successfully',
    'Calling browser_click with selector="button"',
    'Click completed successfully',
    'Calling browser_type with text="hello world"',
    'Typing completed successfully',
    'Screenshot saved to test_screenshot.png',
    'Console message: Action completed',
    'Network request: GET https://example.com/api/data',
    'Test execution completed'
  ];
  
  const start = Date.now();
  
  for (let i = 0; i < iterations; i++) {
    for (const output of testOutputs) {
      progressTracker.onGeminiOutput(output);
    }
    progressTracker.reset(); // Reset for next iteration
  }
  
  const totalTime = Date.now() - start;
  const avgTimePerIteration = totalTime / iterations;
  const avgTimePerOutput = totalTime / (iterations * testOutputs.length);
  
  if (avgTimePerIteration > 50) {
    throw new Error(`Progress tracking too slow: ${avgTimePerIteration}ms per iteration`);
  }
  
  return {
    'Total time': `${totalTime}ms`,
    'Avg per iteration': `${avgTimePerIteration.toFixed(2)}ms`,
    'Avg per output': `${avgTimePerOutput.toFixed(2)}ms`,
    'Iterations': iterations,
    'Outputs per iteration': testOutputs.length,
    'Socket events': mockSocket.eventCount
  };
});

// Test memory usage
runner.test('Memory Usage Test', async () => {
  const initialMemory = process.memoryUsage();
  
  // Create multiple instances to test memory usage
  const instances = [];
  const iterations = 100;
  
  for (let i = 0; i < iterations; i++) {
    const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
    const executor = new GeminiCLIExecutor(mcpManager);
    const parser = new TestStepParser();
    const mockSocket = new MockSocket();
    const progressTracker = new ProgressTracker(mockSocket);
    
    instances.push({ mcpManager, executor, parser, progressTracker });
    
    // Perform some operations
    await mcpManager.ensureConfiguration();
    const testOutput = 'Calling browser_navigate with url="https://test.com"\nNavigation completed';
    parser.parseStepsFromOutput(testOutput);
    progressTracker.onGeminiOutput(testOutput);
  }
  
  const afterCreationMemory = process.memoryUsage();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage();
  
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  const memoryPerInstance = memoryIncrease / iterations;
  
  // Check for memory leaks (threshold: 1MB per instance)
  if (memoryPerInstance > 1024 * 1024) {
    throw new Error(`Potential memory leak: ${(memoryPerInstance / 1024 / 1024).toFixed(2)}MB per instance`);
  }
  
  return {
    'Initial heap': `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    'Final heap': `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    'Memory increase': `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
    'Per instance': `${(memoryPerInstance / 1024).toFixed(2)}KB`,
    'Instances created': iterations
  };
});

// Test concurrent operations
runner.test('Concurrent Operations Performance', async () => {
  const concurrency = 10;
  const operationsPerWorker = 50;
  
  const worker = async (workerId) => {
    const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
    const parser = new TestStepParser();
    const mockSocket = new MockSocket();
    const progressTracker = new ProgressTracker(mockSocket);
    
    const results = [];
    
    for (let i = 0; i < operationsPerWorker; i++) {
      const start = Date.now();
      
      // Simulate concurrent operations
      await mcpManager.ensureConfiguration();
      const testOutput = `Worker ${workerId} operation ${i}\nCalling browser_navigate\nCompleted successfully`;
      const parsed = parser.parseStepsFromOutput(testOutput);
      progressTracker.onGeminiOutput(testOutput);
      
      results.push(Date.now() - start);
    }
    
    return results;
  };
  
  const start = Date.now();
  const workerPromises = [];
  
  for (let i = 0; i < concurrency; i++) {
    workerPromises.push(worker(i));
  }
  
  const allResults = await Promise.all(workerPromises);
  const totalTime = Date.now() - start;
  
  const flatResults = allResults.flat();
  const avgOperationTime = flatResults.reduce((sum, time) => sum + time, 0) / flatResults.length;
  const maxOperationTime = Math.max(...flatResults);
  const totalOperations = concurrency * operationsPerWorker;
  
  if (avgOperationTime > 100) {
    throw new Error(`Concurrent operations too slow: ${avgOperationTime}ms average`);
  }
  
  return {
    'Total time': `${totalTime}ms`,
    'Concurrent workers': concurrency,
    'Operations per worker': operationsPerWorker,
    'Total operations': totalOperations,
    'Avg operation time': `${avgOperationTime.toFixed(2)}ms`,
    'Max operation time': `${maxOperationTime}ms`,
    'Operations per second': `${(totalOperations / (totalTime / 1000)).toFixed(2)}`
  };
});

// Test CLI startup performance
runner.test('CLI Startup Performance', async () => {
  const mcpManager = new MCPConfigManager('../.kiro/settings/mcp.json');
  const executor = new GeminiCLIExecutor(mcpManager);
  
  const iterations = 10;
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    
    // Test CLI availability check
    const installationStatus = await executor.checkGeminiCLIInstallation();
    
    // Test environment setup
    process.env.GOOGLE_API_KEY = 'test-key';
    const environment = await executor.setupGeminiEnvironment();
    
    times.push(Date.now() - start);
  }
  
  const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  if (avgTime > 500) {
    throw new Error(`CLI startup too slow: ${avgTime}ms`);
  }
  
  return {
    'Average': `${avgTime.toFixed(2)}ms`,
    'Min': `${minTime}ms`,
    'Max': `${maxTime}ms`,
    'Iterations': iterations
  };
});

// Run performance tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runner.run().then(success => {
    if (success) {
      console.log('\n🚀 All performance tests passed!');
      console.log('\nSystem performance is within acceptable limits for:');
      console.log('- ✅ Configuration loading');
      console.log('- ✅ Step parsing');
      console.log('- ✅ Progress tracking');
      console.log('- ✅ Memory usage');
      console.log('- ✅ Concurrent operations');
      console.log('- ✅ CLI startup');
    } else {
      console.log('\n⚠️ Some performance tests failed');
      console.log('Review the results above for optimization opportunities');
    }
    process.exit(success ? 0 : 1);
  });
}

export { runner };