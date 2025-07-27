# Implementation Plan

- [x] 1. Set up MCP configuration management system
  - Create MCPConfigManager class to handle Playwright MCP server configuration
  - Implement methods for creating, validating, and managing MCP config files
  - Add automatic default configuration generation for .kiro/settings/mcp.json
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Implement Gemini CLI integration layer
  - Create GeminiCLIExecutor class to replace direct ChatGoogleGenerativeAI usage
  - Implement process spawning and management for @google/gemini-cli
  - Add environment setup for MCP integration with Gemini CLI
  - Create comprehensive test prompt builder that includes MCP tool context
  - _Requirements: 1.1, 1.3, 4.1_

- [x] 3. Build test step parsing and mapping system
  - Create TestStepParser class to extract structured data from Gemini CLI output
  - Implement mapping between MCP tool calls and frontend-compatible step format
  - Add validation for parsed test steps and error handling for malformed output
  - Create screenshot path extraction from MCP tool responses
  - _Requirements: 2.1, 2.2, 4.4_

- [x] 4. Develop real-time progress tracking system
  - Create ProgressTracker class to monitor Gemini CLI output streams
  - Implement Socket.IO event emission for MCP tool execution progress
  - Add step status tracking and real-time updates to frontend
  - Create error capture and forwarding mechanism for CLI failures
  - _Requirements: 2.3, 5.1, 5.2_

- [x] 5. Replace direct Playwright usage with MCP tool integration
  - Remove direct Playwright imports and browser management code
  - Update executeTestSteps function to work with parsed MCP tool calls
  - Implement MCP tool parameter mapping for browser automation actions
  - Add support for all 24 Playwright MCP tools (browser_click, browser_type, etc.)
  - _Requirements: 1.2, 2.4, 4.2, 4.3_

- [x] 6. Implement enhanced browser automation capabilities
  - Add support for advanced MCP tools like browser_drag, browser_hover, browser_file_upload
  - Implement multi-tab scenario handling with browser_tab_* tools
  - Create accessibility-based verification using browser_snapshot instead of screenshots
  - Add browser console and network request monitoring capabilities
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Build comprehensive error handling and recovery system
  - Implement error detection for Gemini CLI installation and execution failures
  - Add MCP server connection retry logic with exponential backoff
  - Create automatic browser installation using browser_install tool
  - Implement diagnostic information capture for troubleshooting
  - _Requirements: 1.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Update server initialization and dependency management
  - Modify package.json to include @google/gemini-cli dependency
  - Update server startup to initialize MCP configuration and validate setup
  - Remove @langchain/google-genai dependency and related imports
  - Add proper cleanup for MCP server processes on shutdown
  - _Requirements: 1.3, 3.1, 3.4_

- [x] 9. Create comprehensive test suite for new architecture
  - Write unit tests for MCPConfigManager, GeminiCLIExecutor, and TestStepParser classes
  - Create integration tests for complete test case execution flow
  - Add error scenario testing for various failure conditions
  - Implement performance tests for CLI startup and MCP communication
  - _Requirements: All requirements validation_

- [-] 10. Update Socket.IO event handlers and maintain API compatibility
  - Modify testCaseInitiated handler to use new Gemini CLI integration
  - Ensure backward compatibility with existing frontend Socket.IO events
  - Update message handler to work with Gemini CLI instead of direct API calls
  - Add new event types for enhanced MCP tool feedback
  - _Requirements: 2.3, 2.4, 2.5, 2.6_