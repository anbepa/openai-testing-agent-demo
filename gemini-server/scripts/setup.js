#!/usr/bin/env node

/**
 * Setup script for Gemini Server with MCP integration
 */

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Setting up Gemini Server with MCP integration...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('   Please upgrade Node.js and try again');
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Please run this script from the gemini-server directory');
  process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
const installResult = spawnSync('npm', ['install'], { stdio: 'inherit' });

if (installResult.status !== 0) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

console.log('✅ Dependencies installed');

// Check for Gemini CLI
console.log('\n🤖 Checking Gemini CLI installation...');
const geminiCheck = spawnSync('gemini', ['--version'], { stdio: 'pipe' });

if (geminiCheck.error) {
  console.log('📦 Installing Gemini CLI globally...');
  const geminiInstall = spawnSync('npm', ['install', '-g', '@google/gemini-cli'], { stdio: 'inherit' });
  
  if (geminiInstall.status !== 0) {
    console.log('⚠️ Failed to install Gemini CLI globally');
    console.log('   You can install it manually: npm install -g @google/gemini-cli');
    console.log('   Or the system will attempt to install it on first use');
  } else {
    console.log('✅ Gemini CLI installed globally');
  }
} else {
  console.log('✅ Gemini CLI already installed');
}

// Check for Playwright browsers
console.log('\n🎭 Checking Playwright browsers...');
const playwrightCheck = spawnSync('npx', ['playwright', 'install', '--dry-run'], { stdio: 'pipe' });

if (playwrightCheck.status !== 0) {
  console.log('📦 Installing Playwright browsers...');
  const playwrightInstall = spawnSync('npx', ['playwright', 'install', 'chromium'], { stdio: 'inherit' });
  
  if (playwrightInstall.status !== 0) {
    console.log('⚠️ Failed to install Playwright browsers');
    console.log('   You can install them manually: npx playwright install');
  } else {
    console.log('✅ Playwright browsers installed');
  }
} else {
  console.log('✅ Playwright browsers already installed');
}

// Create environment file if it doesn't exist
console.log('\n⚙️ Setting up environment configuration...');
const envPath = '.env.development';

if (!fs.existsSync(envPath)) {
  const envExample = fs.readFileSync('.env.example', 'utf8');
  fs.writeFileSync(envPath, envExample);
  console.log(`✅ Created ${envPath} from template`);
  console.log('   Please edit this file and add your GOOGLE_API_KEY');
} else {
  console.log(`✅ Environment file ${envPath} already exists`);
}

// Create MCP configuration directory
console.log('\n🔧 Setting up MCP configuration...');
const mcpDir = '../.kiro/settings';

if (!fs.existsSync(mcpDir)) {
  fs.mkdirSync(mcpDir, { recursive: true });
  console.log('✅ Created MCP configuration directory');
} else {
  console.log('✅ MCP configuration directory already exists');
}

// Create screenshots directory
console.log('\n📸 Setting up screenshots directory...');
const screenshotsDir = 'screenshots';

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  console.log('✅ Created screenshots directory');
} else {
  console.log('✅ Screenshots directory already exists');
}

// Validate setup
console.log('\n🔍 Validating setup...');

// Check if Google API key is configured
const envContent = fs.readFileSync(envPath, 'utf8');
if (!envContent.includes('GOOGLE_API_KEY=') || envContent.includes('your_google_api_key_here')) {
  console.log('⚠️ Google API key not configured');
  console.log('   Please edit .env.development and add your GOOGLE_API_KEY');
} else {
  console.log('✅ Google API key configured');
}

// Final setup summary
console.log('\n🎉 Setup completed!\n');
console.log('Next steps:');
console.log('1. Make sure your GOOGLE_API_KEY is set in .env.development');
console.log('2. Run the server: npm run dev');
console.log('3. Enable MCP integration by setting USE_MCP_INTEGRATION=true in .env.development');
console.log('\nFeatures available:');
console.log('- ✅ Gemini CLI integration');
console.log('- ✅ 24 Playwright MCP tools');
console.log('- ✅ Real-time progress tracking');
console.log('- ✅ Enhanced error handling and recovery');
console.log('- ✅ Advanced browser automation capabilities');
console.log('\nFor help and documentation, visit: https://github.com/google/gemini-cli');