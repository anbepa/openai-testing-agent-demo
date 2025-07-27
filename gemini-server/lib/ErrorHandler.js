/**
 * Comprehensive error handling and recovery system for Gemini CLI + MCP integration
 */
export class ErrorHandler {
  constructor(mcpConfigManager, geminiCLIExecutor) {
    this.mcpConfigManager = mcpConfigManager;
    this.geminiCLIExecutor = geminiCLIExecutor;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.backoffMultiplier = 2;
    this.baseDelay = 1000;
  }

  /**
   * Handles Gemini CLI installation and execution errors
   */
  async handleGeminiCLIError(error, context = {}) {
    const errorType = this.classifyGeminiError(error);
    
    console.error(`Gemini CLI Error [${errorType}]:`, error.message);
    
    switch (errorType) {
      case 'GEMINI_CLI_NOT_FOUND':
        return await this.handleGeminiCLINotFound(error, context);
        
      case 'GEMINI_CLI_TIMEOUT':
        return await this.handleGeminiCLITimeout(error, context);
        
      case 'GEMINI_CLI_PROCESS_FAILED':
        return await this.handleGeminiCLIProcessFailed(error, context);
        
      case 'GEMINI_API_ERROR':
        return await this.handleGeminiAPIError(error, context);
        
      case 'GEMINI_CLI_PERMISSION_ERROR':
        return await this.handlePermissionError(error, context);
        
      default:
        return await this.handleGenericGeminiError(error, context);
    }
  }

  /**
   * Handles MCP server connection and tool execution errors
   */
  async handleMCPError(error, context = {}) {
    const errorType = this.classifyMCPError(error);
    
    console.error(`MCP Error [${errorType}]:`, error.message);
    
    switch (errorType) {
      case 'MCP_SERVER_FAILED':
        return await this.handleMCPServerFailed(error, context);
        
      case 'MCP_CONNECTION_TIMEOUT':
        return await this.handleMCPConnectionTimeout(error, context);
        
      case 'MCP_TOOL_EXECUTION_ERROR':
        return await this.handleMCPToolExecutionError(error, context);
        
      case 'BROWSER_NOT_INSTALLED':
        return await this.handleBrowserNotInstalled(error, context);
        
      case 'MCP_CONFIGURATION_ERROR':
        return await this.handleMCPConfigurationError(error, context);
        
      default:
        return await this.handleGenericMCPError(error, context);
    }
  }

  /**
   * Handles network and connectivity errors
   */
  async handleNetworkError(error, context = {}) {
    const errorType = this.classifyNetworkError(error);
    
    console.error(`Network Error [${errorType}]:`, error.message);
    
    switch (errorType) {
      case 'NETWORK_TIMEOUT':
        return await this.handleNetworkTimeout(error, context);
        
      case 'CONNECTION_REFUSED':
        return await this.handleConnectionRefused(error, context);
        
      case 'DNS_ERROR':
        return await this.handleDNSError(error, context);
        
      default:
        return await this.handleGenericNetworkError(error, context);
    }
  }

  // Gemini CLI Error Handlers

  async handleGeminiCLINotFound(error, context) {
    try {
      console.log('🔧 Gemini CLI not found, attempting installation...');
      await this.geminiCLIExecutor.installGeminiCLI();
      
      return {
        recovered: true,
        action: 'installed_gemini_cli',
        message: 'Gemini CLI installed successfully',
        retry: true
      };
    } catch (installError) {
      return {
        recovered: false,
        action: 'install_failed',
        message: `Failed to install Gemini CLI: ${installError.message}`,
        suggestion: 'Please install @google/gemini-cli manually: npm install -g @google/gemini-cli'
      };
    }
  }

  async handleGeminiCLITimeout(error, context) {
    const retryKey = 'gemini_cli_timeout';
    const attempts = this.getRetryAttempts(retryKey);
    
    if (attempts < this.maxRetries) {
      this.incrementRetryAttempts(retryKey);
      const delay = this.calculateBackoffDelay(attempts);
      
      console.log(`⏳ Gemini CLI timeout, retrying in ${delay}ms (attempt ${attempts + 1}/${this.maxRetries})`);
      await this.sleep(delay);
      
      return {
        recovered: true,
        action: 'retry_with_backoff',
        message: `Retrying Gemini CLI execution (attempt ${attempts + 1})`,
        retry: true
      };
    }
    
    return {
      recovered: false,
      action: 'max_retries_exceeded',
      message: 'Gemini CLI timeout after maximum retry attempts',
      suggestion: 'Check your internet connection and API key configuration'
    };
  }

  async handleGeminiCLIProcessFailed(error, context) {
    // Terminate any hanging process
    this.geminiCLIExecutor.terminate();
    
    const retryKey = 'gemini_cli_process';
    const attempts = this.getRetryAttempts(retryKey);
    
    if (attempts < this.maxRetries) {
      this.incrementRetryAttempts(retryKey);
      
      console.log(`🔄 Gemini CLI process failed, restarting (attempt ${attempts + 1}/${this.maxRetries})`);
      
      return {
        recovered: true,
        action: 'restart_process',
        message: `Restarting Gemini CLI process (attempt ${attempts + 1})`,
        retry: true
      };
    }
    
    return {
      recovered: false,
      action: 'process_restart_failed',
      message: 'Gemini CLI process failed after multiple restart attempts',
      suggestion: 'Check system resources and process permissions'
    };
  }

  async handleGeminiAPIError(error, context) {
    if (error.message.includes('API key')) {
      return {
        recovered: false,
        action: 'api_key_error',
        message: 'Invalid or missing Google API key',
        suggestion: 'Please check your GOOGLE_API_KEY environment variable'
      };
    }
    
    if (error.message.includes('quota') || error.message.includes('rate limit')) {
      const delay = 60000; // 1 minute
      console.log(`⏱️ API rate limit hit, waiting ${delay}ms before retry`);
      await this.sleep(delay);
      
      return {
        recovered: true,
        action: 'rate_limit_wait',
        message: 'Waited for rate limit reset',
        retry: true
      };
    }
    
    return {
      recovered: false,
      action: 'api_error',
      message: `Gemini API error: ${error.message}`,
      suggestion: 'Check API status and configuration'
    };
  }

  async handlePermissionError(error, context) {
    return {
      recovered: false,
      action: 'permission_denied',
      message: 'Permission denied accessing Gemini CLI',
      suggestion: 'Run with appropriate permissions or check file system access'
    };
  }

  // MCP Error Handlers

  async handleMCPServerFailed(error, context) {
    try {
      console.log('🔄 MCP server failed, attempting restart...');
      
      // Stop existing server
      await this.mcpConfigManager.stopMCPServer();
      
      // Wait before restart
      await this.sleep(2000);
      
      // Start server again
      await this.mcpConfigManager.startMCPServer();
      
      return {
        recovered: true,
        action: 'restarted_mcp_server',
        message: 'MCP server restarted successfully',
        retry: true
      };
    } catch (restartError) {
      return {
        recovered: false,
        action: 'mcp_restart_failed',
        message: `Failed to restart MCP server: ${restartError.message}`,
        suggestion: 'Check MCP server configuration and dependencies'
      };
    }
  }

  async handleMCPConnectionTimeout(error, context) {
    const retryKey = 'mcp_connection';
    const attempts = this.getRetryAttempts(retryKey);
    
    if (attempts < this.maxRetries) {
      this.incrementRetryAttempts(retryKey);
      const delay = this.calculateBackoffDelay(attempts);
      
      console.log(`🔌 MCP connection timeout, retrying in ${delay}ms (attempt ${attempts + 1}/${this.maxRetries})`);
      await this.sleep(delay);
      
      // Try to validate connection
      try {
        await this.mcpConfigManager.validateConnection();
        return {
          recovered: true,
          action: 'connection_restored',
          message: 'MCP connection restored',
          retry: true
        };
      } catch (validationError) {
        // Connection still failed, continue with retry
        return {
          recovered: true,
          action: 'retry_connection',
          message: `Retrying MCP connection (attempt ${attempts + 1})`,
          retry: true
        };
      }
    }
    
    return {
      recovered: false,
      action: 'connection_failed',
      message: 'MCP connection failed after maximum retry attempts',
      suggestion: 'Check MCP server status and network connectivity'
    };
  }

  async handleMCPToolExecutionError(error, context) {
    const toolName = context.toolName || 'unknown';
    
    if (error.message.includes('browser not installed')) {
      return await this.handleBrowserNotInstalled(error, context);
    }
    
    if (error.message.includes('timeout')) {
      return {
        recovered: true,
        action: 'tool_timeout_retry',
        message: `MCP tool ${toolName} timed out, continuing with next step`,
        retry: false // Don't retry the same tool, continue with test
      };
    }
    
    return {
      recovered: true,
      action: 'tool_error_continue',
      message: `MCP tool ${toolName} failed: ${error.message}`,
      retry: false // Continue with test execution
    };
  }

  async handleBrowserNotInstalled(error, context) {
    try {
      console.log('📦 Browser not installed, attempting installation...');
      
      // This would typically call browser_install MCP tool
      // For now, we'll provide instructions
      return {
        recovered: false,
        action: 'browser_install_required',
        message: 'Browser installation required',
        suggestion: 'Run: npx playwright install chromium'
      };
    } catch (installError) {
      return {
        recovered: false,
        action: 'browser_install_failed',
        message: `Browser installation failed: ${installError.message}`,
        suggestion: 'Manually install browser: npx playwright install'
      };
    }
  }

  async handleMCPConfigurationError(error, context) {
    try {
      console.log('⚙️ MCP configuration error, recreating default config...');
      
      await this.mcpConfigManager.createDefaultConfig();
      
      return {
        recovered: true,
        action: 'recreated_config',
        message: 'MCP configuration recreated with defaults',
        retry: true
      };
    } catch (configError) {
      return {
        recovered: false,
        action: 'config_recreation_failed',
        message: `Failed to recreate MCP configuration: ${configError.message}`,
        suggestion: 'Check file system permissions and configuration directory'
      };
    }
  }

  // Network Error Handlers

  async handleNetworkTimeout(error, context) {
    const retryKey = 'network_timeout';
    const attempts = this.getRetryAttempts(retryKey);
    
    if (attempts < this.maxRetries) {
      this.incrementRetryAttempts(retryKey);
      const delay = this.calculateBackoffDelay(attempts);
      
      console.log(`🌐 Network timeout, retrying in ${delay}ms (attempt ${attempts + 1}/${this.maxRetries})`);
      await this.sleep(delay);
      
      return {
        recovered: true,
        action: 'network_retry',
        message: `Retrying network operation (attempt ${attempts + 1})`,
        retry: true
      };
    }
    
    return {
      recovered: false,
      action: 'network_timeout_final',
      message: 'Network timeout after maximum retry attempts',
      suggestion: 'Check internet connection and firewall settings'
    };
  }

  async handleConnectionRefused(error, context) {
    return {
      recovered: false,
      action: 'connection_refused',
      message: 'Connection refused by server',
      suggestion: 'Check server status and network configuration'
    };
  }

  async handleDNSError(error, context) {
    return {
      recovered: false,
      action: 'dns_error',
      message: 'DNS resolution failed',
      suggestion: 'Check DNS settings and internet connectivity'
    };
  }

  // Generic Error Handlers

  async handleGenericGeminiError(error, context) {
    return {
      recovered: false,
      action: 'generic_gemini_error',
      message: `Gemini CLI error: ${error.message}`,
      suggestion: 'Check Gemini CLI configuration and logs'
    };
  }

  async handleGenericMCPError(error, context) {
    return {
      recovered: false,
      action: 'generic_mcp_error',
      message: `MCP error: ${error.message}`,
      suggestion: 'Check MCP server status and configuration'
    };
  }

  async handleGenericNetworkError(error, context) {
    return {
      recovered: false,
      action: 'generic_network_error',
      message: `Network error: ${error.message}`,
      suggestion: 'Check network connectivity and configuration'
    };
  }

  // Error Classification

  classifyGeminiError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('command not found') || message.includes('gemini-cli not found')) {
      return 'GEMINI_CLI_NOT_FOUND';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'GEMINI_CLI_TIMEOUT';
    }
    if (message.includes('process') && message.includes('failed')) {
      return 'GEMINI_CLI_PROCESS_FAILED';
    }
    if (message.includes('api key') || message.includes('authentication')) {
      return 'GEMINI_API_ERROR';
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return 'GEMINI_CLI_PERMISSION_ERROR';
    }
    
    return 'GENERIC_GEMINI_ERROR';
  }

  classifyMCPError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('mcp server') && message.includes('failed')) {
      return 'MCP_SERVER_FAILED';
    }
    if (message.includes('connection') && message.includes('timeout')) {
      return 'MCP_CONNECTION_TIMEOUT';
    }
    if (message.includes('browser') && message.includes('not installed')) {
      return 'BROWSER_NOT_INSTALLED';
    }
    if (message.includes('tool') && message.includes('execution')) {
      return 'MCP_TOOL_EXECUTION_ERROR';
    }
    if (message.includes('configuration') || message.includes('config')) {
      return 'MCP_CONFIGURATION_ERROR';
    }
    
    return 'GENERIC_MCP_ERROR';
  }

  classifyNetworkError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) {
      return 'NETWORK_TIMEOUT';
    }
    if (message.includes('connection refused') || message.includes('econnrefused')) {
      return 'CONNECTION_REFUSED';
    }
    if (message.includes('dns') || message.includes('enotfound')) {
      return 'DNS_ERROR';
    }
    
    return 'GENERIC_NETWORK_ERROR';
  }

  // Utility Methods

  getRetryAttempts(key) {
    return this.retryAttempts.get(key) || 0;
  }

  incrementRetryAttempts(key) {
    const current = this.getRetryAttempts(key);
    this.retryAttempts.set(key, current + 1);
  }

  resetRetryAttempts(key) {
    this.retryAttempts.delete(key);
  }

  calculateBackoffDelay(attempt) {
    return this.baseDelay * Math.pow(this.backoffMultiplier, attempt);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Provides diagnostic information for troubleshooting
   */
  getDiagnosticInfo() {
    return {
      retryAttempts: Object.fromEntries(this.retryAttempts),
      maxRetries: this.maxRetries,
      backoffMultiplier: this.backoffMultiplier,
      baseDelay: this.baseDelay,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Resets error handler state
   */
  reset() {
    this.retryAttempts.clear();
  }
}