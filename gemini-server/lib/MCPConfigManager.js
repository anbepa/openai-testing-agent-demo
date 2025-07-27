import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export class MCPConfigManager {
    constructor(configPath = '.kiro/settings/mcp.json') {
        this.configPath = path.resolve(configPath);
        this.mcpProcess = null;
    }

    /**
     * Ensures MCP configuration exists, creates default if missing
     */
    async ensureConfiguration() {
        try {
            if (!fs.existsSync(this.configPath)) {
                console.log('Creating default MCP configuration...');
                await this.createDefaultConfig();
            }

            const config = this.loadConfig();
            this.validateConfig(config);
            console.log('✅ MCP configuration validated');
            return config;
        } catch (error) {
            console.error('❌ MCP configuration error:', error.message);
            throw new Error(`MCP configuration failed: ${error.message}`);
        }
    }

    /**
     * Creates default MCP configuration file
     */
    async createDefaultConfig() {
        const defaultConfig = {
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
                        "browser_snapshot",
                        "browser_wait_for",
                        "browser_close",
                        "browser_console_messages",
                        "browser_network_requests"
                    ]
                }
            }
        };

        // Ensure directory exists
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`✅ Created default MCP config at ${this.configPath}`);
    }

    /**
     * Loads and parses MCP configuration
     */
    loadConfig() {
        try {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            return JSON.parse(configContent);
        } catch (error) {
            throw new Error(`Failed to load MCP config: ${error.message}`);
        }
    }

    /**
     * Validates MCP configuration structure
     */
    validateConfig(config) {
        if (!config.mcpServers) {
            throw new Error('MCP config missing mcpServers section');
        }

        if (!config.mcpServers.playwright) {
            throw new Error('MCP config missing playwright server configuration');
        }

        const playwrightConfig = config.mcpServers.playwright;
        if (!playwrightConfig.command || !Array.isArray(playwrightConfig.args)) {
            throw new Error('Invalid playwright server configuration');
        }
    }

    /**
     * Starts the Playwright MCP server process
     */
    async startMCPServer() {
        const config = this.loadConfig();
        const playwrightConfig = config.mcpServers.playwright;

        if (playwrightConfig.disabled) {
            console.log('⚠️ Playwright MCP server is disabled in config');
            return null;
        }

        if (this.mcpProcess) {
            console.log('MCP server already running');
            return this.mcpProcess;
        }

        try {
            console.log('🚀 Starting Playwright MCP server...');

            const env = {
                ...process.env,
                ...playwrightConfig.env
            };

            this.mcpProcess = spawn(playwrightConfig.command, playwrightConfig.args, {
                env,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Handle process events
            this.mcpProcess.on('error', (error) => {
                console.error('❌ MCP server error:', error);
                this.mcpProcess = null;
            });

            this.mcpProcess.on('exit', (code) => {
                console.log(`MCP server exited with code ${code}`);
                this.mcpProcess = null;
            });

            // Give the server time to start
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (this.mcpProcess && !this.mcpProcess.killed) {
                console.log('✅ Playwright MCP server started successfully');
                return this.mcpProcess;
            } else {
                throw new Error('MCP server failed to start');
            }

        } catch (error) {
            console.error('❌ Failed to start MCP server:', error);
            this.mcpProcess = null;
            throw error;
        }
    }

    /**
     * Stops the MCP server process
     */
    async stopMCPServer() {
        if (this.mcpProcess) {
            console.log('🛑 Stopping MCP server...');
            this.mcpProcess.kill('SIGTERM');

            // Wait for graceful shutdown
            await new Promise(resolve => {
                if (this.mcpProcess) {
                    this.mcpProcess.on('exit', resolve);
                    setTimeout(() => {
                        if (this.mcpProcess && !this.mcpProcess.killed) {
                            this.mcpProcess.kill('SIGKILL');
                        }
                        resolve();
                    }, 5000);
                } else {
                    resolve();
                }
            });

            this.mcpProcess = null;
            console.log('✅ MCP server stopped');
        }
    }

    /**
     * Validates MCP server connection
     */
    async validateConnection() {
        if (!this.mcpProcess || this.mcpProcess.killed) {
            throw new Error('MCP server is not running');
        }

        // Simple validation - check if process is alive
        try {
            process.kill(this.mcpProcess.pid, 0);
            console.log('✅ MCP server connection validated');
            return true;
        } catch (error) {
            throw new Error('MCP server process is not responding');
        }
    }

    /**
     * Gets the default configuration object
     */
    getDefaultConfig() {
        return {
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
                        "browser_snapshot",
                        "browser_wait_for",
                        "browser_close",
                        "browser_console_messages",
                        "browser_network_requests"
                    ]
                }
            }
        };
    }

    /**
     * Gets the current configuration
     */
    getConfig() {
        return this.loadConfig();
    }

    /**
     * Updates configuration and restarts server if needed
     */
    async updateConfig(newConfig) {
        this.validateConfig(newConfig);
        fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2));

        // Restart server with new config
        if (this.mcpProcess) {
            await this.stopMCPServer();
            await this.startMCPServer();
        }

        console.log('✅ MCP configuration updated');
    }
}