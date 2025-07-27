/**
 * Socket.IO event handler with backward compatibility
 */
export class SocketEventHandler {
  constructor(mcpConfigManager, geminiCLIExecutor, errorHandler) {
    this.mcpConfigManager = mcpConfigManager;
    this.geminiCLIExecutor = geminiCLIExecutor;
    this.errorHandler = errorHandler;
    this.activeConnections = new Map();
  }

  /**
   * Handles new socket connections
   */
  handleConnection(socket) {
    console.log(`Client connected: ${socket.id}`);
    
    // Store connection info
    this.activeConnections.set(socket.id, {
      connectedAt: new Date(),
      lastActivity: new Date(),
      testCasesExecuted: 0
    });

    // Set up event handlers
    this.setupEventHandlers(socket);

    // Send welcome message
    socket.emit('message', '🔗 Connected to Gemini Testing Server');
    socket.emit('message', `🎭 Integration mode: ${process.env.USE_MCP_INTEGRATION === 'true' ? 'Gemini CLI + MCP' : 'Legacy Playwright'}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Sets up all event handlers for a socket
   */
  setupEventHandlers(socket) {
    // Main test case execution handler
    socket.on('testCaseInitiated', async (data) => {
      await this.handleTestCaseInitiated(socket, data);
    });

    // General message handler
    socket.on('message', async (msg) => {
      await this.handleMessage(socket, msg);
    });

    // Legacy event handlers for backward compatibility
    socket.on('executeTest', async (data) => {
      console.log('⚠️ Legacy event "executeTest" received, mapping to "testCaseInitiated"');
      await this.handleTestCaseInitiated(socket, data);
    });

    socket.on('chat', async (msg) => {
      console.log('⚠️ Legacy event "chat" received, mapping to "message"');
      await this.handleMessage(socket, msg);
    });

    // Status and health check handlers
    socket.on('getStatus', () => {
      this.handleGetStatus(socket);
    });

    socket.on('getCapabilities', () => {
      this.handleGetCapabilities(socket);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
      socket.emit('message', `❌ Socket error: ${error.message}`);
    });
  }

  /**
   * Handles test case initiation with enhanced error handling
   */
  async handleTestCaseInitiated(socket, data) {
    try {
      // Update connection activity
      this.updateConnectionActivity(socket.id);

      console.log(`Test case initiated by ${socket.id}:`, data);

      // Validate input data
      const validationResult = this.validateTestCaseData(data);
      if (!validationResult.valid) {
        socket.emit('message', `❌ Invalid test data: ${validationResult.error}`);
        return;
      }

      // Check if we should use the new Gemini CLI + MCP integration
      if (process.env.USE_MCP_INTEGRATION === 'true') {
        await this.executeWithGeminiCLI(socket, data);
      } else {
        await this.executeWithLegacyPlaywright(socket, data);
