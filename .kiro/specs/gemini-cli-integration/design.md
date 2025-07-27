# Design Document

## Overview

This design refactors the existing gemini-server to use @google/gemini-cli with Playwright MCP integration instead of direct API calls. The new architecture separates AI reasoning (Gemini CLI) from browser automation (Playwright MCP) while maintaining the same Socket.IO-based real-time communication with the frontend.

The key architectural change is replacing the current monolithic approach with a modular system where:
- Gemini CLI handles AI-powered test step generation with access to MCP tools
- Playwright MCP provides specialized browser automation capabilities
- The server orchestrates communication between these components and the frontend

## Architecture

### High-Level Architecture

```mermaid
graph TB
    Frontend[Frontend UI] -->|Socket.IO| Server[Gemini Server]
    Server -->|spawn process| GeminiCLI[@google/gemini-cli]
    GeminiCLI -->|MCP Protocol| PlaywrightMCP[Playwright MCP Server]
    PlaywrightMCP -->|Browser Control| Browser[Chromium Browser]
    Server -->|File System| Screenshots[Screenshots Directory]
    Server -->|Config Management| MCPConfig[MCP Configuration]
```

### Component Interaction Flow

1. **Test Initiation**: Frontend sends test case via Socket.IO
2. **MCP Setup**: Server ensures Playwright MCP server is running
3. **AI Processing**: Server spawns Gemini CLI with test instructions
4. **Tool Execution**: Gemini CLI uses Playwright MCP tools for browser automation
5. **Real-time Updates**: Server captures and forwards progress to frontend
6. **Result Aggregation**: Server collects screenshots and test results

## Components and Interfaces

### 1. MCP Configuration Manager

**Purpose**: Manages Playwright MCP server configuration and lifecycle

```javascript
class MCPConfigManager {
  constructor(configPath = '.kiro/settings/mcp.json')
  
  async ensureConfiguration()
  async startMCPServer()
  async stopMCPServer()
  async validateConnection()
  getDefaultConfig()
}
```

**Key Methods**:
- `ensureConfiguration()`: Creates default MCP config if missing
- `startMCPServer()`: Launches Playwright MCP server process
- `validateConnection()`: Tests MCP server connectivity

### 2. Gemini CLI Executor

**Purpose**: Manages Gemini CLI process execution with MCP integration

```javascript
class GeminiCLIExecutor {
  constructor(mcpConfigManager)
  
  async executeTestCase(testData, progressCallback)
  async setupGeminiEnvironment()
  buildTestPrompt(testData)
  parseGeminiOutput(output)
}
```

**Key Methods**:
- `executeTestCase()`: Spawns Gemini CLI with test instructions
- `setupGeminiEnvironment()`: Configures environment variables and MCP settings
- `buildTestPrompt()`: Creates comprehensive prompt with MCP tool context

### 3. Test Step Parser

**Purpose**: Parses and validates Gemini CLI output for test execution tracking

```javascript
class TestStepParser {
  parseStepsFromOutput(output)
  validateStepFormat(step)
  extractScreenshotPaths(output)
  mapMCPToolsToSteps(steps)
}
```

**Key Methods**:
- `parseStepsFromOutput()`: Extracts structured test steps from CLI output
- `mapMCPToolsToSteps()`: Maps MCP tool calls to frontend-compatible step format

### 4. Real-time Progress Tracker

**Purpose**: Captures Gemini CLI output and converts to Socket.IO events

```javascript
class ProgressTracker {
  constructor(socket)
  
  onGeminiOutput(data)
  onMCPToolCall(toolName, params)
  onStepComplete(stepData)
  onError(error)
}
```

**Key Methods**:
- `onGeminiOutput()`: Processes raw CLI output for progress updates
- `onMCPToolCall()`: Tracks specific MCP tool executions
- `onStepComplete()`: Formats step completion for frontend

## Data Models

### Test Case Input
```javascript
{
  testCase: string,        // Natural language test description
  url: string,            // Target website URL
  loginRequired: boolean, // Whether authentication is needed
  userName?: string,      // Login username
  password?: string,      // Login password
  userInfo?: string       // Additional user data (JSON string)
}
```

### MCP Configuration
```javascript
{
  mcpServers: {
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: {
        PLAYWRIGHT_HEADLESS: "false",
        PLAYWRIGHT_SLOW_MO: "1000"
      },
      disabled: false,
      autoApprove: [
        "browser_navigate",
        "browser_click", 
        "browser_type",
        "browser_take_screenshot",
        "browser_snapshot"
      ]
    }
  }
}
```

### Test Step Output
```javascript
{
  step_number: number,
  step_instructions: string,
  mcp_tool_used: string,     // e.g., "browser_click"
  tool_parameters: object,   // MCP tool parameters
  status: "pending" | "running" | "Pass" | "Fail",
  step_reasoning?: string,
  image_path?: string,
  console_messages?: string[],
  network_requests?: object[]
}
```

## Error Handling

### 1. Gemini CLI Errors
- **Installation Check**: Verify @google/gemini-cli is available
- **Process Failures**: Capture stderr and provide diagnostic information
- **Timeout Handling**: Kill hanging processes and provide fallback

### 2. MCP Server Errors
- **Connection Failures**: Retry logic with exponential backoff
- **Tool Execution Errors**: Capture specific MCP tool error messages
- **Browser Installation**: Automatic browser_install call when needed

### 3. Configuration Errors
- **Missing Config**: Auto-generate default MCP configuration
- **Invalid Settings**: Validate and sanitize MCP server settings
- **Permission Issues**: Clear error messages for file system access

### Error Recovery Strategies
```javascript
const errorRecoveryStrategies = {
  'GEMINI_CLI_NOT_FOUND': () => installGeminiCLI(),
  'MCP_SERVER_FAILED': () => restartMCPServer(),
  'BROWSER_NOT_INSTALLED': () => callBrowserInstall(),
  'NETWORK_TIMEOUT': () => retryWithBackoff(),
  'PERMISSION_DENIED': () => suggestPermissionFix()
}
```

## Testing Strategy

### 1. Unit Tests
- **MCP Configuration Manager**: Test config creation, validation, and server lifecycle
- **Gemini CLI Executor**: Mock CLI processes and test output parsing
- **Test Step Parser**: Validate step parsing and MCP tool mapping
- **Progress Tracker**: Test Socket.IO event emission and formatting

### 2. Integration Tests
- **End-to-End Flow**: Complete test case execution from frontend to browser
- **MCP Tool Integration**: Verify all 24 Playwright MCP tools work correctly
- **Error Scenarios**: Test recovery from various failure conditions
- **Real Browser Testing**: Validate actual browser automation works

### 3. Performance Tests
- **CLI Startup Time**: Measure Gemini CLI initialization overhead
- **MCP Communication**: Test MCP protocol communication latency
- **Memory Usage**: Monitor resource consumption during long test runs
- **Concurrent Tests**: Validate multiple simultaneous test executions

### Test Environment Setup
```javascript
// Test configuration for isolated testing
const testConfig = {
  mcpServers: {
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
      env: {
        PLAYWRIGHT_HEADLESS: "true",  // Headless for CI
        PLAYWRIGHT_SLOW_MO: "0"      // No slowdown for tests
      }
    }
  }
}
```

## Implementation Considerations

### 1. Backward Compatibility
- Maintain existing Socket.IO event structure for frontend compatibility
- Preserve screenshot functionality and file paths
- Keep same test step format for UI consistency

### 2. Performance Optimizations
- **Process Reuse**: Keep Gemini CLI process alive for multiple test cases
- **MCP Connection Pooling**: Reuse MCP server connections
- **Lazy Loading**: Start MCP server only when needed

### 3. Security Considerations
- **Sandboxed Execution**: Run Gemini CLI in isolated environment
- **Input Validation**: Sanitize all test case inputs
- **File System Access**: Restrict screenshot directory access
- **Network Security**: Validate target URLs and prevent SSRF

### 4. Monitoring and Logging
- **Structured Logging**: Use consistent log format for debugging
- **Performance Metrics**: Track CLI execution times and success rates
- **Error Tracking**: Comprehensive error categorization and reporting
- **Resource Monitoring**: Track memory and CPU usage patterns