export class TestStepParser {
  constructor() {
    // MCP tool to frontend action type mapping
    this.mcpToolMapping = {
      'browser_navigate': 'navigate',
      'browser_click': 'click',
      'browser_type': 'type',
      'browser_wait_for': 'wait',
      'browser_take_screenshot': 'screenshot',
      'browser_snapshot': 'verify',
      'browser_close': 'close',
      'browser_hover': 'hover',
      'browser_drag': 'drag',
      'browser_file_upload': 'upload',
      'browser_handle_dialog': 'dialog',
      'browser_press_key': 'keypress',
      'browser_resize': 'resize',
      'browser_select_option': 'select',
      'browser_tab_new': 'tab_new',
      'browser_tab_select': 'tab_select',
      'browser_tab_close': 'tab_close',
      'browser_tab_list': 'tab_list',
      'browser_console_messages': 'console',
      'browser_network_requests': 'network'
    };

    // Patterns for detecting different types of content in output
    this.patterns = {
      mcpToolCall: /(?:Calling|Using|Executing)\s+(browser_\w+)(?:\s+with\s+(.+?))?/i,
      mcpToolResult: /(browser_\w+)\s+(?:completed|finished|succeeded|failed)(?:\s+(.+?))?/i,
      screenshot: /(?:screenshot|image)\s+(?:saved|captured|taken)(?:\s+(?:to|at|as))?\s+([^\s]+\.png)/i,
      error: /(?:error|failed|exception|timeout)(?::\s*(.+?))?$/i,
      success: /(?:success|completed|finished|done)(?::\s*(.+?))?$/i,
      stepStart: /^(?:Step\s+(\d+)|(\d+)\.)\s*[:\-]?\s*(.+)/i,
      url: /(https?:\/\/[^\s]+)/g,
      selector: /(?:selector|element|locator)(?:\s*[:=]\s*)?['"`]([^'"`]+)['"`]/i,
      text: /(?:text|type|input)(?:\s*[:=]\s*)?['"`]([^'"`]+)['"`]/i
    };
  }

  /**
   * Parses Gemini CLI output and extracts structured test steps
   */
  parseStepsFromOutput(output) {
    const lines = output.split('\n');
    const steps = [];
    const screenshots = [];
    const errors = [];
    const consoleMessages = [];
    const networkRequests = [];

    let currentStep = null;
    let stepNumber = 1;
    let lineBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      if (!trimmedLine) continue;

      // Buffer multi-line content
      lineBuffer += trimmedLine + ' ';

      // Process the buffered content
      const processedStep = this.processLine(lineBuffer, stepNumber);
      
      if (processedStep) {
        // If we have a current step, finalize it
        if (currentStep) {
          this.finalizeStep(currentStep);
          steps.push(currentStep);
        }

        // Start new step
        currentStep = processedStep;
        stepNumber++;
        lineBuffer = '';
      } else {
        // Update current step with additional information
        if (currentStep) {
          this.updateStepWithLine(currentStep, trimmedLine, {
            screenshots,
            errors,
            consoleMessages,
            networkRequests
          });
        }
      }

      // Clear buffer if it gets too long (prevent memory issues)
      if (lineBuffer.length > 1000) {
        lineBuffer = '';
      }
    }

    // Finalize the last step
    if (currentStep) {
      this.finalizeStep(currentStep);
      steps.push(currentStep);
    }

    return {
      steps: this.validateAndCleanSteps(steps),
      screenshots,
      errors,
      consoleMessages,
      networkRequests,
      rawOutput: output
    };
  }

  /**
   * Processes a line to detect if it starts a new step
   */
  processLine(line, stepNumber) {
    // Check for MCP tool calls
    const mcpMatch = line.match(this.patterns.mcpToolCall);
    if (mcpMatch) {
      const toolName = mcpMatch[1];
      const parameters = mcpMatch[2] || '';
      
      return {
        step_number: stepNumber,
        step_instructions: this.extractInstructions(line),
        mcp_tool_used: toolName,
        action_type: this.mcpToolMapping[toolName] || 'unknown',
        tool_parameters: this.parseToolParameters(parameters),
        status: 'running',
        timestamp: new Date().toISOString(),
        output: line.trim()
      };
    }

    // Check for explicit step markers
    const stepMatch = line.match(this.patterns.stepStart);
    if (stepMatch) {
      const explicitStepNumber = stepMatch[1] || stepMatch[2];
      const instruction = stepMatch[3];
      
      return {
        step_number: explicitStepNumber ? parseInt(explicitStepNumber) : stepNumber,
        step_instructions: instruction,
        mcp_tool_used: this.inferMCPTool(instruction),
        action_type: this.inferActionType(instruction),
        tool_parameters: this.extractParametersFromInstruction(instruction),
        status: 'pending',
        timestamp: new Date().toISOString(),
        output: line.trim()
      };
    }

    return null;
  }

  /**
   * Updates an existing step with additional information from a line
   */
  updateStepWithLine(step, line, collections) {
    // Check for completion/failure
    const errorMatch = line.match(this.patterns.error);
    if (errorMatch || line.toLowerCase().includes('failed')) {
      step.status = 'Fail';
      step.step_reasoning = errorMatch ? (errorMatch[1] || line) : line;
      collections.errors.push(line);
      return;
    }

    const successMatch = line.match(this.patterns.success);
    if (successMatch) {
      step.status = 'Pass';
      step.step_reasoning = successMatch[1] || 'Step completed successfully';
      return;
    }

    // Check for screenshots
    const screenshotMatch = line.match(this.patterns.screenshot);
    if (screenshotMatch) {
      const screenshotPath = screenshotMatch[1];
      step.image_path = screenshotPath;
      collections.screenshots.push(screenshotPath);
      return;
    }

    // Check for console messages
    if (line.includes('console:') || line.includes('Console message:')) {
      const consoleMsg = line.replace(/^.*?console:?\s*/i, '');
      collections.consoleMessages.push(consoleMsg);
      if (!step.console_messages) step.console_messages = [];
      step.console_messages.push(consoleMsg);
      return;
    }

    // Check for network requests
    if (line.includes('network:') || line.includes('Network request:')) {
      const networkMsg = line.replace(/^.*?network:?\s*/i, '');
      collections.networkRequests.push(networkMsg);
      if (!step.network_requests) step.network_requests = [];
      step.network_requests.push(networkMsg);
      return;
    }

    // Add to general output
    if (step.output) {
      step.output += '\n' + line;
    } else {
      step.output = line;
    }
  }

  /**
   * Finalizes a step by ensuring all required fields are present
   */
  finalizeStep(step) {
    // Set default status if not set
    if (!step.status || step.status === 'running') {
      step.status = 'Pass'; // Assume success if no explicit failure
    }

    // Ensure step_reasoning is set
    if (!step.step_reasoning) {
      step.step_reasoning = step.status === 'Pass' 
        ? 'Step completed successfully' 
        : 'Step status unknown';
    }

    // Clean up output
    if (step.output) {
      step.output = step.output.trim();
    }

    // Add completion timestamp
    step.completed_at = new Date().toISOString();
  }

  /**
   * Validates and cleans the steps array
   */
  validateAndCleanSteps(steps) {
    return steps
      .filter(step => this.validateStepFormat(step))
      .map(step => this.cleanStep(step))
      .sort((a, b) => a.step_number - b.step_number);
  }

  /**
   * Validates that a step has the required format
   */
  validateStepFormat(step) {
    const required = ['step_number', 'step_instructions', 'status'];
    
    for (const field of required) {
      if (!step[field]) {
        console.warn(`Step missing required field: ${field}`, step);
        return false;
      }
    }

    // Validate step_number is a number
    if (typeof step.step_number !== 'number' || step.step_number < 1) {
      console.warn('Invalid step_number:', step.step_number);
      return false;
    }

    // Validate status
    const validStatuses = ['pending', 'running', 'Pass', 'Fail'];
    if (!validStatuses.includes(step.status)) {
      console.warn('Invalid status:', step.status);
      return false;
    }

    return true;
  }

  /**
   * Cleans a step by removing unnecessary fields and formatting
   */
  cleanStep(step) {
    const cleaned = { ...step };

    // Remove internal fields
    delete cleaned.timestamp;
    delete cleaned.completed_at;

    // Ensure target field exists for backward compatibility
    if (!cleaned.target && cleaned.tool_parameters) {
      cleaned.target = this.extractTargetFromParameters(cleaned.tool_parameters);
    }

    // Truncate long output
    if (cleaned.output && cleaned.output.length > 500) {
      cleaned.output = cleaned.output.substring(0, 500) + '...';
    }

    return cleaned;
  }

  /**
   * Maps MCP tool calls to frontend-compatible step format
   */
  mapMCPToolsToSteps(steps) {
    return steps.map(step => {
      const mapped = { ...step };

      // Map MCP tool to action type
      if (step.mcp_tool_used && this.mcpToolMapping[step.mcp_tool_used]) {
        mapped.action_type = this.mcpToolMapping[step.mcp_tool_used];
      }

      // Convert tool parameters to target format for backward compatibility
      if (step.tool_parameters && !step.target) {
        mapped.target = this.convertParametersToTarget(step.tool_parameters, step.mcp_tool_used);
      }

      return mapped;
    });
  }

  /**
   * Extracts screenshot paths from output
   */
  extractScreenshotPaths(output) {
    const screenshots = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(this.patterns.screenshot);
      if (match) {
        screenshots.push(match[1]);
      }
    }

    return screenshots;
  }

  // Helper methods

  extractInstructions(line) {
    // Remove MCP tool call prefix and extract the actual instruction
    return line
      .replace(/^(?:Calling|Using|Executing)\s+browser_\w+\s*(?:with\s+)?/i, '')
      .replace(/^[:\-]\s*/, '')
      .trim() || 'Executing browser action';
  }

  parseToolParameters(paramString) {
    if (!paramString) return {};

    try {
      // Try to parse as JSON first
      if (paramString.startsWith('{') && paramString.endsWith('}')) {
        return JSON.parse(paramString);
      }

      // Parse key=value pairs
      const params = {};
      const pairs = paramString.split(/,\s*/);
      
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^['"`]|['"`]$/g, '');
          params[key.trim()] = value;
        }
      }

      return params;
    } catch (error) {
      console.warn('Failed to parse tool parameters:', paramString);
      return { raw: paramString };
    }
  }

  inferMCPTool(instruction) {
    const lower = instruction.toLowerCase();
    
    if (lower.includes('navigate') || lower.includes('go to')) return 'browser_navigate';
    if (lower.includes('click')) return 'browser_click';
    if (lower.includes('type') || lower.includes('enter')) return 'browser_type';
    if (lower.includes('wait')) return 'browser_wait_for';
    if (lower.includes('screenshot')) return 'browser_take_screenshot';
    if (lower.includes('verify') || lower.includes('check')) return 'browser_snapshot';
    if (lower.includes('hover')) return 'browser_hover';
    if (lower.includes('drag')) return 'browser_drag';
    if (lower.includes('upload')) return 'browser_file_upload';
    if (lower.includes('dialog')) return 'browser_handle_dialog';
    if (lower.includes('key') || lower.includes('press')) return 'browser_press_key';
    if (lower.includes('resize')) return 'browser_resize';
    if (lower.includes('select')) return 'browser_select_option';
    if (lower.includes('tab')) {
      if (lower.includes('new')) return 'browser_tab_new';
      if (lower.includes('close')) return 'browser_tab_close';
      if (lower.includes('switch') || lower.includes('select')) return 'browser_tab_select';
      return 'browser_tab_list';
    }
    
    return 'browser_navigate'; // Default fallback
  }

  inferActionType(instruction) {
    const mcpTool = this.inferMCPTool(instruction);
    return this.mcpToolMapping[mcpTool] || 'unknown';
  }

  extractParametersFromInstruction(instruction) {
    const params = {};

    // Extract URL
    const urlMatch = instruction.match(this.patterns.url);
    if (urlMatch) {
      params.url = urlMatch[0];
    }

    // Extract selector
    const selectorMatch = instruction.match(this.patterns.selector);
    if (selectorMatch) {
      params.selector = selectorMatch[1];
    }

    // Extract text
    const textMatch = instruction.match(this.patterns.text);
    if (textMatch) {
      params.text = textMatch[1];
    }

    return params;
  }

  extractTargetFromParameters(parameters) {
    if (typeof parameters === 'string') return parameters;
    if (!parameters || typeof parameters !== 'object') return '';

    // Priority order for target extraction
    const targetFields = ['url', 'selector', 'element', 'text', 'target', 'value'];
    
    for (const field of targetFields) {
      if (parameters[field]) {
        return parameters[field];
      }
    }

    // If no standard field, return first non-empty value
    const values = Object.values(parameters).filter(v => v && typeof v === 'string');
    return values[0] || '';
  }

  convertParametersToTarget(parameters, mcpTool) {
    if (!parameters) return '';

    switch (mcpTool) {
      case 'browser_navigate':
        return parameters.url || parameters.target || '';
        
      case 'browser_click':
      case 'browser_hover':
        return parameters.selector || parameters.element || parameters.target || '';
        
      case 'browser_type':
        const selector = parameters.selector || parameters.element || '';
        const text = parameters.text || parameters.value || '';
        return selector && text ? `${selector}|${text}` : (selector || text);
        
      case 'browser_wait_for':
        return parameters.condition || parameters.selector || parameters.timeout || '';
        
      case 'browser_take_screenshot':
        return parameters.path || parameters.filename || 'screenshot.png';
        
      default:
        return this.extractTargetFromParameters(parameters);
    }
  }
}