#!/usr/bin/env node

/**
 * toggle-verification.js
 * 
 * Tool to toggle 2FA / OTP verification for customer Job Order phases
 * (Quotation approval, Mechanic additional findings, etc.)
 * 
 * Usage:
 *   node scripts/toggle-verification.js on      -> Enable 2FA verification (production mode)
 *   node scripts/toggle-verification.js off     -> Disable 2FA verification (fast test mode)
 *   node scripts/toggle-verification.js toggle  -> Switch between on and off
 *   node scripts/toggle-verification.js status  -> Show current mode
 *   node scripts/toggle-verification.js         -> Interactive terminal menu
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG_PATH = path.join(__dirname, '..', 'src', 'config', 'test-mode.json');

function getStatus() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return Boolean(data.bypassVerification);
    }
  } catch (e) {
    // ignore
  }
  return false;
}

function setStatus(bypassed) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ bypassVerification: bypassed, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8'
  );
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function printBanner() {
  console.log('\n' + colors.cyan + '='.repeat(62) + colors.reset);
  console.log(colors.bold + ' 🚗  AutoKita — Job Order Verification Mode Manager' + colors.reset);
  console.log(colors.cyan + '='.repeat(62) + colors.reset);
}

function printStatus(bypassed) {
  if (bypassed) {
    console.log(
      ' Current Status: ' +
      colors.yellow + colors.bold + '🟡 TEST MODE (Verification DISABLED / BYPASSED)' + colors.reset
    );
    console.log(colors.dim + '   • Quotation approval skips email OTP codes.' + colors.reset);
    console.log(colors.dim + '   • Additional findings approve instantly without OTP.' + colors.reset);
    console.log(colors.dim + '   • Fast phase-by-phase testing is ready.' + colors.reset);
  } else {
    console.log(
      ' Current Status: ' +
      colors.green + colors.bold + '🟢 NORMAL MODE (Verification ENABLED / REQUIRED)' + colors.reset
    );
    console.log(colors.dim + '   • 6-digit codes are sent to email for confirmation.' + colors.reset);
    console.log(colors.dim + '   • Full 2FA security is active.' + colors.reset);
  }
  console.log(colors.cyan + '='.repeat(62) + colors.reset + '\n');
}

function execute(arg) {
  const current = getStatus();
  const normalized = (arg || '').toLowerCase().trim();

  if (normalized === 'status' || normalized === 'check' || normalized === '-s') {
    printBanner();
    printStatus(current);
    return;
  }

  if (normalized === 'off' || normalized === 'disable' || normalized === 'false' || normalized === '0') {
    setStatus(true);
    printBanner();
    console.log(colors.yellow + colors.bold + ' ✔ Verification has been TURNED OFF (Test Mode Activated)!' + colors.reset);
    printStatus(true);
    return;
  }

  if (normalized === 'on' || normalized === 'enable' || normalized === 'true' || normalized === '1') {
    setStatus(false);
    printBanner();
    console.log(colors.green + colors.bold + ' ✔ Verification has been TURNED ON (Normal Mode Activated)!' + colors.reset);
    printStatus(false);
    return;
  }

  if (normalized === 'toggle' || normalized === 't') {
    const next = !current;
    setStatus(next);
    printBanner();
    console.log(colors.bold + ` ✔ Verification toggled to: ${next ? colors.yellow + 'OFF (Test Mode)' : colors.green + 'ON (Required)'}` + colors.reset);
    printStatus(next);
    return;
  }

  // Interactive mode if no argument or unrecognized
  runInteractive();
}

function runInteractive() {
  printBanner();
  const current = getStatus();
  printStatus(current);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Select an option:');
  console.log(colors.yellow + '  [1] Turn OFF verification' + colors.reset + ' (Fast test mode for Job Order phases)');
  console.log(colors.green + '  [2] Turn ON verification' + colors.reset + ' (Require 6-digit email OTP)');
  console.log('  [3] Toggle verification mode');
  console.log(colors.dim + '  [4] Exit without changes\n' + colors.reset);

  rl.question('Enter your choice (1-4): ', (answer) => {
    rl.close();
    const choice = answer.trim();

    if (choice === '1') {
      setStatus(true);
      console.log(colors.yellow + colors.bold + '\n ✔ Verification is now DISABLED. Fast test mode is active!\n' + colors.reset);
    } else if (choice === '2') {
      setStatus(false);
      console.log(colors.green + colors.bold + '\n ✔ Verification is now ENABLED. 6-digit OTP is required.\n' + colors.reset);
    } else if (choice === '3') {
      const next = !current;
      setStatus(next);
      console.log(colors.bold + `\n ✔ Toggled to: ${next ? colors.yellow + 'DISABLED (Test Mode)' : colors.green + 'ENABLED (Normal Mode)'}\n` + colors.reset);
    } else {
      console.log('\nExiting without changes.\n');
    }
  });
}

const arg = process.argv[2];
execute(arg);
