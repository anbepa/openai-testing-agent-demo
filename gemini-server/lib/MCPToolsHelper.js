/**
 * Helper class for MCP tools integration and enhanced browser automation
 */
export class MCPToolsHelper {
  constructor() {
    // MCP tool capabilities mapping
    this.toolCapabilities = {
      'browser_navigate': {
        description: 'Navigate to a URL',
        parameters: ['url', 'waitUntil'],
        examples: ['browser_navigate("https://example.com")', 'browser_navigate("https://example.com", "networkidle")']
      },
      'browser_click': {
        description: 'Click on elements',
        parameters: ['selector', 'button', 'modifiers'],
        examples: ['browser_click("button.submit")', 'browser_click("a[href]", "right")']
      },
      'browser_type': {
        description: 'Type text into elements',
        parameters: ['selector', 'text', 'delay'],
        examples: ['browser_type("input[name=email]", "user@example.com")', 'browser_type("textarea", "Hello world", 100)']
      },
      'browser_wait_for': {
        description: 'Wait for conditions',
        parameters: ['condition', 'timeout'],
        examples: ['browser_wait_for("text=Welcome")', 'browser_wait_for("selector=.loading", 5000)']
      },
      'browser_take_screenshot': {
        description: 'Capture screenshots',
        parameters: ['path', 'fullPage', 'clip'],
        examples: ['browser_take_screenshot("screenshot.png")', 'browser_take_screenshot("full.png", true)']
      },
      'browser_snapshot': {
        description: 'Get accessibility snapshot (better than screenshot for element detection)',
        parameters: ['selector'],
        examples: ['browser_snapshot()', 'browser_snapshot("main")']
      },
      'browser_hover': {
        description: 'Hover over elements',
        parameters: ['selector', 'position'],
        examples: ['browser_hover(".tooltip-trigger")', 'browser_hover("button", {x: 10, y: 10})']
      },
      'browser_drag': {
        description: 'Drag and drop between elements',
        parameters: ['sourceSelector', 'targetSelector'],
        examples: ['browser_drag(".draggable", ".drop-zone")', 'browser_drag("#item1", "#container")']
      },
      'browser_file_upload': {
        description: 'Upload files',
        parameters: ['selector', 'files'],
        examples: ['browser_file_upload("input[type=file]", ["file.txt"])', 'browser_file_upload(".upload", ["image.png", "doc.pdf"])']
      },
      'browser_handle_dialog': {
        description: 'Handle dialogs (alert, confirm, prompt)',
        parameters: ['accept', 'promptText'],
        examples: ['browser_handle_dialog(true)', 'browser_handle_dialog(true, "User input")']
      },
      'browser_press_key': {
        description: 'Press keyboard keys',
        parameters: ['key', 'modifiers'],
        examples: ['browser_press_key("Enter")', 'browser_press_key("s", ["Control"])']
      },
      'browser_select_option': {
        description: 'Select dropdown options',
        parameters: ['selector', 'values'],
        examples: ['browser_select_option("select", ["option1"])', 'browser_select_option("#dropdown", ["value1", "value2"])']
      },
      'browser_resize': {
        description: 'Resize browser window',
        parameters: ['width', 'height'],
        examples: ['browser_resize(1920, 1080)', 'browser_resize(375, 667)']
      },
      'browser_tab_new': {
        description: 'Open new tab',
        parameters: ['url'],
        examples: ['browser_tab_new()', 'browser_tab_new("https://example.com")']
      },
      'browser_tab_select': {
        description: 'Switch to tab by index',
        parameters: ['index'],
        examples: ['browser_tab_select(0)', 'browser_tab_select(2)']
      },
      'browser_tab_close': {
        description: 'Close tab',
        parameters: ['index'],
        examples: ['browser_tab_close()', 'browser_tab_close(1)']
      },
      'browser_tab_list': {
        description: 'List all open tabs',
        parameters: [],
        examples: ['browser_tab_list()']
      },
      'browser_console_messages': {
        description: 'Get console messages',
        parameters: [],
        examples: ['browser_console_messages()']
      },
      'browser_network_requests': {
        description: 'Get network requests',
        parameters: [],
        examples: ['browser_network_requests()']
      },
      'browser_close': {
        description: 'Close browser',
        parameters: [],
        examples: ['browser_close()']
      }
    };
  }

  /**
   * Gets enhanced prompt instructions for complex scenarios
   */
  getEnhancedInstructions(testCase) {
    const instructions = [];
    const lowerCase = testCase.toLowerCase();

    // Detect scenario types and provide specific instructions
    if (lowerCase.includes('drag') || lowerCase.includes('drop')) {
      instructions.push('🔄 DRAG & DROP: Use browser_drag(sourceSelector, targetSelector) for drag and drop interactions');
    }

    if (lowerCase.includes('hover') || lowerCase.includes('tooltip') || lowerCase.includes('menu')) {
      instructions.push('🖱️ HOVER: Use browser_hover(selector) to trigger hover effects and reveal hidden elements');
    }

    if (lowerCase.includes('upload') || lowerCase.includes('file')) {
      instructions.push('📁 FILE UPLOAD: Use browser_file_upload(selector, [filePaths]) for file upload scenarios');
    }

    if (lowerCase.includes('tab') || lowerCase.includes('window') || lowerCase.includes('new page')) {
      instructions.push('🗂️ MULTI-TAB: Use browser_tab_new(), browser_tab_select(index), browser_tab_close() for multi-tab workflows');
    }

    if (lowerCase.includes('alert') || lowerCase.includes('confirm') || lowerCase.includes('prompt') || lowerCase.includes('dialog')) {
      instructions.push('💬 DIALOGS: Use browser_handle_dialog(accept, promptText) for alert/confirm/prompt dialogs');
    }

    if (lowerCase.includes('keyboard') || lowerCase.includes('shortcut') || lowerCase.includes('key')) {
      instructions.push('⌨️ KEYBOARD: Use browser_press_key(key, modifiers) for keyboard shortcuts and special keys');
    }

    if (lowerCase.includes('dropdown') || lowerCase.includes('select') || lowerCase.includes('option')) {
      instructions.push('📋 DROPDOWNS: Use browser_select_option(selector, values) for dropdown selections');
    }

    if (lowerCase.includes('responsive') || lowerCase.includes('mobile') || lowerCase.includes('resize')) {
      instructions.push('📱 RESPONSIVE: Use browser_resize(width, height) for responsive testing');
    }

    if (lowerCase.includes('console') || lowerCase.includes('error') || lowerCase.includes('debug')) {
      instructions.push('🐛 DEBUGGING: Use browser_console_messages() to capture JavaScript errors and logs');
    }

    if (lowerCase.includes('network') || lowerCase.includes('api') || lowerCase.includes('request')) {
      instructions.push('🌐 NETWORK: Use browser_network_requests() to monitor API calls and resource loading');
    }

    if (lowerCase.includes('accessibility') || lowerCase.includes('a11y') || lowerCase.includes('screen reader')) {
      instructions.push('♿ ACCESSIBILITY: Use browser_snapshot() for accessibility-based element detection');
    }

    return instructions;
  }

  /**
   * Gets tool-specific best practices
   */
  getBestPractices() {
    return [
      '🎯 ELEMENT DETECTION: Always use browser_snapshot() before interacting with elements to understand page structure',
      '⏱️ SMART WAITING: Use browser_wait_for() with specific conditions rather than fixed timeouts',
      '📸 VISUAL VERIFICATION: Take browser_take_screenshot() after major actions for visual verification',
      '🔍 ERROR HANDLING: Capture browser_console_messages() when errors occur for better debugging',
      '📊 PERFORMANCE: Monitor browser_network_requests() for API calls and resource loading',
      '🎨 RESPONSIVE: Test different viewport sizes using browser_resize() for responsive design',
      '🔄 MULTI-TAB: Manage multiple tabs efficiently with browser_tab_* tools',
      '⚡ EFFICIENCY: Use appropriate tools for each interaction type (hover, drag, type, click)',
      '♿ ACCESSIBILITY: Prefer semantic selectors and ARIA attributes when possible',
      '🛡️ ROBUSTNESS: Handle dialogs and unexpected popups with browser_handle_dialog()'
    ];
  }

  /**
   * Generates enhanced test scenarios based on capabilities
   */
  generateScenarioSuggestions(testCase) {
    const suggestions = [];
    const lowerCase = testCase.toLowerCase();

    // E-commerce scenarios
    if (lowerCase.includes('shop') || lowerCase.includes('cart') || lowerCase.includes('buy')) {
      suggestions.push({
        scenario: 'E-commerce Workflow',
        tools: ['browser_navigate', 'browser_snapshot', 'browser_click', 'browser_type', 'browser_select_option', 'browser_take_screenshot'],
        description: 'Navigate → Search → Add to cart → Checkout → Payment'
      });
    }

    // Form scenarios
    if (lowerCase.includes('form') || lowerCase.includes('submit') || lowerCase.includes('register')) {
      suggestions.push({
        scenario: 'Form Interaction',
        tools: ['browser_type', 'browser_select_option', 'browser_file_upload', 'browser_click', 'browser_handle_dialog'],
        description: 'Fill form fields → Upload files → Submit → Handle confirmations'
      });
    }

    // Dashboard scenarios
    if (lowerCase.includes('dashboard') || lowerCase.includes('admin') || lowerCase.includes('panel')) {
      suggestions.push({
        scenario: 'Dashboard Navigation',
        tools: ['browser_hover', 'browser_click', 'browser_tab_new', 'browser_resize', 'browser_console_messages'],
        description: 'Navigate menus → Open multiple tabs → Responsive testing → Monitor errors'
      });
    }

    // Interactive scenarios
    if (lowerCase.includes('interactive') || lowerCase.includes('game') || lowerCase.includes('canvas')) {
      suggestions.push({
        scenario: 'Interactive Elements',
        tools: ['browser_drag', 'browser_hover', 'browser_press_key', 'browser_click', 'browser_network_requests'],
        description: 'Drag & drop → Hover effects → Keyboard controls → Monitor network activity'
      });
    }

    return suggestions;
  }

  /**
   * Validates MCP tool usage
   */
  validateToolUsage(toolName, parameters) {
    const tool = this.toolCapabilities[toolName];
    if (!tool) {
      return { valid: false, error: `Unknown MCP tool: ${toolName}` };
    }

    // Basic parameter validation
    if (tool.parameters.length > 0 && (!parameters || Object.keys(parameters).length === 0)) {
      return { 
        valid: false, 
        error: `Tool ${toolName} requires parameters: ${tool.parameters.join(', ')}` 
      };
    }

    return { valid: true };
  }

  /**
   * Gets tool documentation
   */
  getToolDocumentation(toolName) {
    const tool = this.toolCapabilities[toolName];
    if (!tool) {
      return null;
    }

    return {
      name: toolName,
      description: tool.description,
      parameters: tool.parameters,
      examples: tool.examples,
      usage: `Use ${toolName} for ${tool.description.toLowerCase()}`
    };
  }

  /**
   * Gets all available tools grouped by category
   */
  getToolsByCategory() {
    return {
      'Navigation': ['browser_navigate', 'browser_tab_new', 'browser_tab_select', 'browser_tab_close', 'browser_tab_list'],
      'Interaction': ['browser_click', 'browser_type', 'browser_hover', 'browser_drag', 'browser_press_key'],
      'Form Controls': ['browser_select_option', 'browser_file_upload', 'browser_handle_dialog'],
      'Verification': ['browser_snapshot', 'browser_take_screenshot', 'browser_wait_for'],
      'Debugging': ['browser_console_messages', 'browser_network_requests'],
      'Browser Control': ['browser_resize', 'browser_close']
    };
  }
}