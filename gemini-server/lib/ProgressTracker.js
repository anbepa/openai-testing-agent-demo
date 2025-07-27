import { TestStepParser } from './TestStepParser.js';

export class ProgressTracker {
  constructor(socket) {
    this.socket = socket;
    this.stepParser = new TestStepParser();
    this.accumulatedOutput = '';
    this.currentSteps = [];
    this.lastStepCount = 0;
    this.diagnostics = {
      consoleMessages: [],
      networkRequests: [],
      errors: [],
      screenshots: []
    };
  }

  /**
   * Processes Gemini CLI output and sends real-time updates
   */
  onGeminiOutput(data) {
    try {
      // Accumulate output for better parsing
      this.accumulatedOutput += data;
      
      // Parse the accumulated output
      const parsed = this.stepParser.parseStepsFromOutput(this.accumulatedOutput);
      
      // Update current steps
      this.currentSteps = parsed.steps;
      
      // Send step updates if there are new steps
      if (parsed.steps.length > this.lastStepCount) {
        this.sendStepUpdates(parsed.steps);
        this.lastStepCount = parsed.steps.length;
      }
      
      // Update diagnostics
      this.updateDiagnostics(parsed);
      
      // Send diagnostic updates
      this.sendDiagnosticUpdates(parsed);
      
      // Send formatted progress message
      this.sendProgressMessage(data);
      
    } catch (error) {
      console.error('Progress tracking error:', error);
      this.socket.emit('message', `⚠️ Progress tracking error: ${error.message}`);
    }
  }

  /**
   * Handles MCP tool call events
   */
  onMCPToolCall(toolName, params) {
    const message = this.formatMCPToolMessage(toolName, params);
    this.socket.emit('message', `🔧 ${message}`);
    
    // Update step status if we can match it
    this.updateStepForToolCall(toolName, params);
  }

  /**
   * Handles step completion events
   */
  onStepComplete(stepData) {
    // Find and update the corresponding step
    const stepIndex = this.currentSteps.findIndex(s => 
      s.step_number === stepData.step_number ||
      s.mcp_tool_used === stepData.mcp_tool_used
    );
    
    if (stepIndex !== -1) {
      this.currentSteps[stepIndex] = { ...this.currentSteps[stepIndex], ...stepData };
      this.sendStepUpdates(this.currentSteps);
    }
    
    // Send completion message
    const status = stepData.status === 'Pass' ? '✅' : '❌';
    this.socket.emit('message', `${status} Step ${stepData.step_number}: ${stepData.step_instructions}`);
  }

  /**
   * Handles error events
   */
  onError(error) {
    this.diagnostics.errors.push({
      message: error.message || error,
      timestamp: new Date().toISOString(),
      type: 'execution_error'
    });
    
    this.socket.emit('message', `❌ Error: ${error.message || error}`);
    
    // Update current step status if applicable
    if (this.currentSteps.length > 0) {
      const lastStep = this.currentSteps[this.currentSteps.length - 1];
      if (lastStep.status === 'running') {
        lastStep.status = 'Fail';
        lastStep.step_reasoning = error.message || error;
        this.sendStepUpdates(this.currentSteps);
      }
    }
  }

  /**
   * Sends step updates to the frontend
   */
  sendStepUpdates(steps) {
    if (steps && steps.length > 0) {
      // Map steps to frontend format
      const mappedSteps = this.stepParser.mapMCPToolsToSteps(steps);
      
      // Send both events for compatibility
      this.socket.emit('testcases', JSON.stringify({ steps: mappedSteps }));
      this.socket.emit('testscriptupdate', JSON.stringify({ steps: mappedSteps }));
    }
  }

  /**
   * Updates internal diagnostics
   */
  updateDiagnostics(parsed) {
    // Update console messages
    if (parsed.consoleMessages.length > this.diagnostics.consoleMessages.length) {
      const newMessages = parsed.consoleMessages.slice(this.diagnostics.consoleMessages.length);
      this.diagnostics.consoleMessages.push(...newMessages);
    }
    
    // Update network requests
    if (parsed.networkRequests.length > this.diagnostics.networkRequests.length) {
      const newRequests = parsed.networkRequests.slice(this.diagnostics.networkRequests.length);
      this.diagnostics.networkRequests.push(...newRequests);
    }
    
    // Update errors
    if (parsed.errors.length > this.diagnostics.errors.length) {
      const newErrors = parsed.errors.slice(this.diagnostics.errors.length);
      this.diagnostics.errors.push(...newErrors.map(err => ({
        message: err,
        timestamp: new Date().toISOString(),
        type: 'step_error'
      })));
    }
    
    // Update screenshots
    if (parsed.screenshots.length > this.diagnostics.screenshots.length) {
      const newScreenshots = parsed.screenshots.slice(this.diagnostics.screenshots.length);
      this.diagnostics.screenshots.push(...newScreenshots);
    }
  }

  /**
   * Sends diagnostic updates to the frontend
   */
  sendDiagnosticUpdates(parsed) {
    // Send new console messages
    const newConsoleCount = parsed.consoleMessages.length - (this.diagnostics.consoleMessages.length - parsed.consoleMessages.length + this.diagnostics.consoleMessages.length);
    if (newConsoleCount > 0) {
      const latestConsole = parsed.consoleMessages[parsed.consoleMessages.length - 1];
      this.socket.emit('message', `🖥️ Console: ${latestConsole}`);
    }
    
    // Send new network requests
    const newNetworkCount = parsed.networkRequests.length - (this.diagnostics.networkRequests.length - parsed.networkRequests.length + this.diagnostics.networkRequests.length);
    if (newNetworkCount > 0) {
      const latestNetwork = parsed.networkRequests[parsed.networkRequests.length - 1];
      this.socket.emit('message', `🌐 Network: ${latestNetwork}`);
    }
    
    // Send new screenshots
    const newScreenshotCount = parsed.screenshots.length - (this.diagnostics.screenshots.length - parsed.screenshots.length + this.diagnostics.screenshots.length);
    if (newScreenshotCount > 0) {
      const latestScreenshot = parsed.screenshots[parsed.screenshots.length - 1];
      this.socket.emit('message', `📸 Screenshot: ${latestScreenshot}`);
    }
  }

  /**
   * Sends formatted progress messages
   */
  sendProgressMessage(rawData) {
    // Clean and format the raw data
    const cleanData = rawData.trim();
    if (!cleanData) return;
    
    // Skip duplicate or internal messages
    if (this.shouldSkipMessage(cleanData)) return;
    
    // Format based on content type
    let formattedMessage = cleanData;
    
    if (cleanData.includes('browser_')) {
      formattedMessage = this.formatBrowserAction(cleanData);
    } else if (cleanData.toLowerCase().includes('error')) {
      formattedMessage = `❌ ${cleanData}`;
    } else if (cleanData.toLowerCase().includes('success') || cleanData.toLowerCase().includes('completed')) {
      formattedMessage = `✅ ${cleanData}`;
    } else if (cleanData.toLowerCase().includes('starting') || cleanData.toLowerCase().includes('beginning')) {
      formattedMessage = `🚀 ${cleanData}`;
    }
    
    this.socket.emit('message', formattedMessage);
  }

  /**
   * Formats MCP tool call messages
   */
  formatMCPToolMessage(toolName, params) {
    const actionMap = {
      'browser_navigate': 'Navigating to',
      'browser_click': 'Clicking on',
      'browser_type': 'Typing in',
      'browser_wait_for': 'Waiting for',
      'browser_take_screenshot': 'Taking screenshot',
      'browser_snapshot': 'Capturing page snapshot',
      'browser_hover': 'Hovering over',
      'browser_drag': 'Dragging element',
      'browser_file_upload': 'Uploading file',
      'browser_handle_dialog': 'Handling dialog',
      'browser_press_key': 'Pressing key',
      'browser_resize': 'Resizing browser',
      'browser_select_option': 'Selecting option',
      'browser_tab_new': 'Opening new tab',
      'browser_tab_select': 'Switching to tab',
      'browser_tab_close': 'Closing tab',
      'browser_console_messages': 'Reading console',
      'browser_network_requests': 'Monitoring network'
    };
    
    const action = actionMap[toolName] || `Executing ${toolName}`;
    
    if (params && typeof params === 'object') {
      const key = Object.keys(params)[0];
      const value = params[key];
      if (key && value) {
        return `${action} ${value}`;
      }
    }
    
    return action;
  }

  /**
   * Updates step status for tool calls
   */
  updateStepForToolCall(toolName, params) {
    // Find the most recent step that matches this tool
    for (let i = this.currentSteps.length - 1; i >= 0; i--) {
      const step = this.currentSteps[i];
      if (step.mcp_tool_used === toolName && step.status === 'running') {
        // Update with tool parameters
        step.tool_parameters = params;
        step.status = 'running'; // Keep as running until completion
        this.sendStepUpdates(this.currentSteps);
        break;
      }
    }
  }

  /**
   * Formats browser action messages
   */
  formatBrowserAction(message) {
    if (message.includes('browser_navigate')) {
      return `🌐 ${message}`;
    } else if (message.includes('browser_click')) {
      return `👆 ${message}`;
    } else if (message.includes('browser_type')) {
      return `⌨️ ${message}`;
    } else if (message.includes('browser_screenshot')) {
      return `📸 ${message}`;
    } else if (message.includes('browser_wait')) {
      return `⏳ ${message}`;
    }
    
    return `🔧 ${message}`;
  }

  /**
   * Determines if a message should be skipped
   */
  shouldSkipMessage(message) {
    const skipPatterns = [
      /^[\s\n\r]*$/,  // Empty or whitespace only
      /^\d+\.\d+\.\d+/,  // Version numbers
      /^DEBUG:/,  // Debug messages
      /^TRACE:/,  // Trace messages
      /^\[object Object\]/,  // Serialized objects
    ];
    
    return skipPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Gets current progress summary
   */
  getProgressSummary() {
    const totalSteps = this.currentSteps.length;
    const completedSteps = this.currentSteps.filter(s => s.status === 'Pass' || s.status === 'Fail').length;
    const failedSteps = this.currentSteps.filter(s => s.status === 'Fail').length;
    
    return {
      totalSteps,
      completedSteps,
      failedSteps,
      successRate: totalSteps > 0 ? ((completedSteps - failedSteps) / totalSteps * 100).toFixed(1) : 0,
      diagnostics: {
        consoleMessages: this.diagnostics.consoleMessages.length,
        networkRequests: this.diagnostics.networkRequests.length,
        errors: this.diagnostics.errors.length,
        screenshots: this.diagnostics.screenshots.length
      }
    };
  }

  /**
   * Sends final summary
   */
  sendFinalSummary() {
    const summary = this.getProgressSummary();
    
    this.socket.emit('message', `🎉 Test execution completed!`);
    this.socket.emit('message', `📊 Results: ${summary.completedSteps - summary.failedSteps}/${summary.totalSteps} steps passed (${summary.successRate}% success rate)`);
    
    if (summary.diagnostics.errors > 0) {
      this.socket.emit('message', `⚠️ ${summary.diagnostics.errors} errors encountered`);
    }
    
    if (summary.diagnostics.consoleMessages > 0) {
      this.socket.emit('message', `🖥️ ${summary.diagnostics.consoleMessages} console messages captured`);
    }
    
    if (summary.diagnostics.networkRequests > 0) {
      this.socket.emit('message', `🌐 ${summary.diagnostics.networkRequests} network requests monitored`);
    }
    
    if (summary.diagnostics.screenshots > 0) {
      this.socket.emit('message', `📸 ${summary.diagnostics.screenshots} screenshots taken`);
    }
  }

  /**
   * Resets the tracker for a new test
   */
  reset() {
    this.accumulatedOutput = '';
    this.currentSteps = [];
    this.lastStepCount = 0;
    this.diagnostics = {
      consoleMessages: [],
      networkRequests: [],
      errors: [],
      screenshots: []
    };
  }
}