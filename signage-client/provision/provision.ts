/**
 * Raspberry Pi Provisioning Tool for Digital Signage Client
 *
 * Usage:
 *   deno task provision --host=192.168.1.50
 *   deno task provision --host=192.168.1.50 --user=player --server-url=https://signage.example.com
 *
 * This tool SSHs into a Raspberry Pi and configures it as a digital signage device.
 * Configuration answers are saved locally so you can re-provision multiple devices
 * with the same settings.
 */

import type { ProvisionStep, SavedConfig, ProvisionOptions } from './types.ts';
import { createContext, ensureKeyPair, copyPublicKey } from './ssh.ts';

// Import all steps in order
import init from './steps/000_init.ts';
import upgrade from './steps/001_upgrade.ts';
import display from './steps/010_display.ts';
import wifi from './steps/020_wifi.ts';
import vpn from './steps/030_vpn.ts';
import deno from './steps/100_deno.ts';
import client from './steps/110_client.ts';

const STEPS: ProvisionStep[] = [init, upgrade, display, wifi, vpn, deno, client];

function parseArgs(args: string[]): ProvisionOptions {
  const options: ProvisionOptions = {
    host: '',
    user: 'player',
    keyFile: './provision_key',
    configFile: './saved-config.json',
  };

  for (const arg of args) {
    if (arg === '--help') {
      console.log(`
Digital Signage Client — Raspberry Pi Provisioner

Usage:
  deno task provision --host=<ip> [options]

Options:
  --host=<ip>           Raspberry Pi hostname or IP address (required)
  --user=<user>         SSH username (default: player)
  --key=<path>          SSH key file (default: ./provision_key)
  --server-url=<url>    Signage server URL
  --config=<path>       Saved config file (default: ./saved-config.json)
  --help                Show this help
`);
      Deno.exit(0);
    }
    const [key, value] = arg.split('=', 2);
    if (!value) continue;
    switch (key) {
      case '--host': options.host = value; break;
      case '--user': options.user = value; break;
      case '--key': options.keyFile = value; break;
      case '--server-url': options.serverUrl = value; break;
      case '--config': options.configFile = value; break;
    }
  }

  return options;
}

async function loadSavedConfig(path: string): Promise<SavedConfig> {
  try {
    const text = await Deno.readTextFile(path);
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function saveSavedConfig(path: string, config: SavedConfig): Promise<void> {
  await Deno.writeTextFile(path, JSON.stringify(config, null, 2) + '\n');
}

async function main() {
  const options = parseArgs(Deno.args);

  if (!options.host) {
    const input = globalThis.prompt('Raspberry Pi host (IP or hostname):');
    options.host = input?.trim() || '';
  }

  if (!options.host) {
    console.error('Error: --host is required');
    Deno.exit(1);
  }

  console.log(`\nProvisioning ${options.user}@${options.host}`);
  console.log('='.repeat(50));

  // SSH key setup
  await ensureKeyPair(options.keyFile);
  await copyPublicKey(options.host, options.user, options.keyFile);

  // Load saved config
  const config = await loadSavedConfig(options.configFile);

  // Apply CLI overrides
  if (options.serverUrl) {
    config.serverUrl = options.serverUrl;
  }

  // Create SSH context
  const ctx = createContext(options.host, options.user, options.keyFile);

  // Test SSH connection
  console.log('\nTesting SSH connection...');
  const test = await ctx.ssh('echo ok');
  if (test.code !== 0) {
    console.error('Failed to connect via SSH. Check host, user, and key.');
    Deno.exit(1);
  }
  console.log('SSH connection successful.\n');

  // Phase 1: Ask all questions upfront
  console.log('--- Configuration ---\n');
  for (const step of STEPS) {
    if (step.ask) {
      await step.ask(config, ctx);
    }
  }

  // Save config after asking (so answers persist even if execution fails)
  for (const step of STEPS) {
    if (step.save) {
      step.save(config);
    }
  }
  await saveSavedConfig(options.configFile, config);
  console.log(`\nConfig saved to ${options.configFile}`);

  // Phase 2: Execute all steps
  console.log('\n--- Executing ---\n');
  for (const step of STEPS) {
    if (step.do) {
      console.log(`[${step.id}] ${step.name}`);
      await step.do(config, ctx);
      console.log();
    }
  }

  console.log('='.repeat(50));
  console.log('Provisioning complete!');

  const reboot = await ctx.confirm('Reboot the Pi now?', true);
  if (reboot) {
    await ctx.sshSudo('reboot');
    console.log('Pi is rebooting. It will connect to the server automatically.');
  }
}

main().catch((err) => {
  console.error('Provisioning failed:', err.message);
  Deno.exit(1);
});
