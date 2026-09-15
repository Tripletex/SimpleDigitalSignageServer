import { loadConfig } from './config.ts';
import { ApiClient } from './api/client.ts';
import { ensureCredentials, reAuthenticate } from './api/auth.ts';
import { WebSocketConnection } from './api/websocket.ts';
import { launchChrome, launchChromeForDisplay, findExistingChrome } from './chrome/launcher.ts';
import { connectCdp } from './chrome/cdp.ts';
import type { CdpClient } from './chrome/cdp.ts';
import { HealthMonitor } from './chrome/health.ts';
import { ContentManager } from './engine/content.ts';
import { Player } from './engine/player.ts';
import { DisplayController, detectDisplays } from './system/display.ts';
import { getNetworkInterfaces } from './system/network.ts';
import { startLocalServer, setOnVideoEnded } from './system/webserver.ts';
import type { ClientConfig, DeviceCredentials, DisplayInfo } from './types.ts';
import type { ChromeProcess } from './chrome/launcher.ts';

let running = true;

/** Per-display Chrome + Player instance. */
interface DisplayInstance {
  display: DisplayInfo;
  chrome: ChromeProcess | null;
  cdp: CdpClient;
  health: HealthMonitor;
  player: Player;
  cdpPort: number;
}

async function main(): Promise<void> {
  console.log('[MAIN] Signage Client starting...');

  // 1. Load config
  const config = await loadConfig(Deno.args);
  console.log(`[MAIN] Server: ${config.serverUrl}, CDP port: ${config.cdpPort}`);

  // 2. Ensure device credentials
  const tempClient = new ApiClient(config.serverUrl, '');
  const creds = await ensureCredentials(config, tempClient);
  const client = new ApiClient(config.serverUrl, creds.apiKey);

  // 3. Start local web server
  startLocalServer(config.localPort);

  // 4. Detect connected displays
  const displays = await detectDisplays();
  const connectedDisplays = displays.filter((d) => d.connected);
  console.log(`[MAIN] Displays: ${connectedDisplays.length} connected (${connectedDisplays.map((d) => d.name).join(', ') || 'none'})`);

  // 5. Send initial heartbeat immediately so server knows our displays
  try {
    await client.ping(creds.deviceId, Deno.hostname(), getNetworkInterfaces(), displays);
    console.log('[MAIN] Initial heartbeat sent');
  } catch (error) {
    console.warn('[MAIN] Initial heartbeat failed:', error instanceof Error ? error.message : error);
  }

  // 6. Launch one Chrome per display
  const instances: DisplayInstance[] = [];

  if (connectedDisplays.length <= 1) {
    // Single display — use the original approach (simpler, uses config.cdpPort)
    const existingChrome = await findExistingChrome(config.cdpPort);
    let chrome: ChromeProcess | null = null;
    if (!existingChrome) {
      chrome = await launchChrome(config);
    } else {
      console.log('[MAIN] Found existing Chrome instance');
    }

    const cdp = await connectCdp(config.cdpPort);
    console.log('[MAIN] CDP connected');

    const singleDisplay = connectedDisplays[0] || { name: 'default', connected: true, primary: true };
    const displayCtrl = new DisplayController();
    const health = new HealthMonitor(cdp);
    const player = new Player(cdp, health, displayCtrl);
    player.setDeviceInfo(creds.deviceId, config.serverUrl, config.localPort);
    player.setDisplayName(singleDisplay.name);

    instances.push({
      display: singleDisplay,
      chrome,
      cdp,
      health,
      player,
      cdpPort: config.cdpPort,
    });
  } else {
    // Multi-display — one Chrome per display with separate CDP ports
    for (let i = 0; i < connectedDisplays.length; i++) {
      const display = connectedDisplays[i];
      const cdpPort = config.cdpPort + i;

      try {
        const existing = await findExistingChrome(cdpPort);
        let chrome: ChromeProcess | null = null;
        if (!existing) {
          chrome = await launchChromeForDisplay(config, display, cdpPort);
        } else {
          console.log(`[MAIN] Found existing Chrome for "${display.name}" on port ${cdpPort}`);
        }

        const cdp = await connectCdp(cdpPort);
        const displayCtrl = new DisplayController();
        const health = new HealthMonitor(cdp);
        const player = new Player(cdp, health, displayCtrl);
        player.setDeviceInfo(creds.deviceId, config.serverUrl, config.localPort);
        player.setDisplayName(display.name);

        instances.push({ display, chrome, cdp, health, player, cdpPort });
        console.log(`[MAIN] Display "${display.name}" ready (CDP port ${cdpPort})`);
      } catch (error) {
        console.error(`[MAIN] Failed to launch Chrome for "${display.name}":`, error instanceof Error ? error.message : error);
      }
    }
  }

  if (instances.length === 0) {
    console.error('[MAIN] No display instances created, exiting');
    Deno.exit(1);
  }

  // Wire up video ended callback to the primary player
  setOnVideoEnded(() => instances[0].player.skipToNext());

  // 6. Set up content manager
  const contentManager = new ContentManager(config, client);

  // 7. Set up WebSocket for push notifications
  const wsConnection = new WebSocketConnection(config.serverUrl, creds.apiKey, async (event) => {
    console.log(`[MAIN] WS event: ${event.type}`);
    if (event.type === 'content_updated' || event.type === 'campaign_changed') {
      await new Promise((r) => setTimeout(r, 500));
      await fetchAndDistributeContent(contentManager, instances);
    } else if (event.type === 'device_released') {
      for (const inst of instances) {
        inst.player.setCampaign(null);
        inst.player.setStatusMessage('Device released from tenant');
      }
    }
  });
  wsConnection.connect();

  // 8. Set up recovery for each instance
  for (const inst of instances) {
    setupRecovery(config, creds, client, inst);
  }

  // 9. Fetch initial content and distribute to displays
  try {
    await fetchAndDistributeContent(contentManager, instances);
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      await handleAuthFailure(config, client, creds, wsConnection, instances);
    }
    for (const inst of instances) {
      inst.player.setStatusMessage('Waiting for content');
    }
  }

  // 10. Start all players and health monitors
  for (const inst of instances) {
    inst.player.start(config.playerTickInterval);
    inst.health.start(config.healthCheckInterval);
  }

  // 11. Start heartbeat
  const heartbeatId = setInterval(async () => {
    try {
      await client.ping(creds.deviceId, Deno.hostname(), getNetworkInterfaces(), displays);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        await handleAuthFailure(config, client, creds, wsConnection, instances);
      }
    }
  }, config.heartbeatInterval);

  // 12. Content refresh
  const refreshInterval = setInterval(async () => {
    try {
      await fetchAndDistributeContent(contentManager, instances);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        await handleAuthFailure(config, client, creds, wsConnection, instances);
      }
    }
  }, config.contentRefreshInterval);

  // 13. Shutdown handling
  const shutdown = () => {
    if (!running) return;
    running = false;
    console.log('\n[MAIN] Shutting down...');
    for (const inst of instances) {
      inst.player.stop();
      inst.health.stop();
      inst.cdp.close();
      inst.chrome?.kill();
    }
    contentManager.stopAutoRefresh();
    clearInterval(heartbeatId);
    clearInterval(refreshInterval);
    wsConnection.disconnect();
    console.log('[MAIN] Goodbye');
    Deno.exit(0);
  };

  Deno.addSignalListener('SIGINT', shutdown);
  Deno.addSignalListener('SIGTERM', shutdown);

  console.log(`[MAIN] Signage Client running with ${instances.length} display(s). Press Ctrl+C to stop.`);

  // Keep alive
  await new Promise(() => {});
}

/**
 * Fetch content and distribute campaigns to each display's player.
 */
async function fetchAndDistributeContent(
  contentManager: ContentManager,
  instances: DisplayInstance[],
): Promise<void> {
  await contentManager.fetchContent();
  const displayCampaigns = contentManager.getDisplayCampaigns();
  const serverKeys = Object.keys(displayCampaigns);
  const clientKeys = instances.map((i) => `${i.display.name}(hw:${i.display.hardwareId || 'none'})`);
  console.log(`[MAIN] Content distribution — server keys: [${serverKeys.join(', ')}], client displays: [${clientKeys.join(', ')}]`);

  for (const inst of instances) {
    // Match by hardwareId first (stable across reboots/cable swaps), then by display name
    const hwId = inst.display.hardwareId;
    const campaign = (hwId && displayCampaigns[hwId]) || displayCampaigns[inst.display.name] || null;
    if (campaign) {
      console.log(`[MAIN] Display "${inst.display.name}" (hw:${hwId}) → campaign "${campaign.name}"`);
      inst.player.setCampaign(campaign);
    } else {
      console.log(`[MAIN] Display "${inst.display.name}" (hw:${hwId}) → no campaign match`);
      inst.player.setStatusMessage(contentManager.statusMessage || 'No campaign assigned');
      inst.player.setCampaign(null);
    }
  }
}

function setupRecovery(
  config: ClientConfig,
  creds: DeviceCredentials,
  client: ApiClient,
  inst: DisplayInstance,
): void {
  inst.cdp.onCrash(async () => {
    console.error(`[MAIN] Display "${inst.display.name}" crashed, attempting reload...`);
    try {
      await inst.cdp.reload();
    } catch {
      console.error(`[MAIN] Reload after crash failed for "${inst.display.name}"`);
    }
  });

  inst.cdp.onDisconnect(async () => {
    if (!running) return;
    console.warn(`[MAIN] CDP disconnected for "${inst.display.name}", attempting reconnect...`);

    let delay = 1000;
    while (running) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30000);

      try {
        const alive = await findExistingChrome(inst.cdpPort);
        if (!alive) {
          console.log(`[MAIN] Chrome died for "${inst.display.name}", relaunching...`);
          inst.chrome = await launchChromeForDisplay(config, inst.display, inst.cdpPort);
        }

        const newCdp = await connectCdp(inst.cdpPort);
        inst.cdp = newCdp;
        inst.health.setCdp(newCdp);
        inst.player.setCdp(newCdp);
        setupRecovery(config, creds, client, inst);
        console.log(`[MAIN] CDP reconnected for "${inst.display.name}"`);
        break;
      } catch (error) {
        console.warn(`[MAIN] Reconnect failed for "${inst.display.name}":`, error instanceof Error ? error.message : error);
      }
    }
  });
}

async function handleAuthFailure(
  config: ClientConfig,
  client: ApiClient,
  creds: DeviceCredentials,
  wsConnection: WebSocketConnection,
  instances: DisplayInstance[],
): Promise<void> {
  try {
    const newApiKey = await reAuthenticate(config, client, creds.deviceId);
    client.setApiKey(newApiKey);
    creds.apiKey = newApiKey;
    wsConnection.setApiKey(newApiKey);
    wsConnection.disconnect();
    wsConnection.connect();
    return;
  } catch (error) {
    console.warn('[MAIN] Re-authentication failed, attempting re-registration:', error instanceof Error ? error.message : error);
  }

  try {
    const tempClient = new ApiClient(config.serverUrl, '');
    const newCreds = await ensureCredentials(config, tempClient, true);
    creds.deviceId = newCreds.deviceId;
    creds.apiKey = newCreds.apiKey;
    client.setApiKey(newCreds.apiKey);
    for (const inst of instances) {
      inst.player.setDeviceInfo(newCreds.deviceId, config.serverUrl, config.localPort);
    }
    wsConnection.setApiKey(newCreds.apiKey);
    wsConnection.disconnect();
    wsConnection.connect();
    console.log(`[MAIN] Re-registered as device ${newCreds.deviceId}`);
  } catch (error) {
    console.error('[MAIN] Re-registration failed:', error instanceof Error ? error.message : error);
  }
}

main().catch((error) => {
  console.error('[MAIN] Fatal error:', error);
  Deno.exit(1);
});
