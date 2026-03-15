import { loadConfig } from './config.ts';
import { ApiClient } from './api/client.ts';
import { ensureCredentials, reAuthenticate } from './api/auth.ts';
import { WebSocketConnection } from './api/websocket.ts';
import { launchChrome, findExistingChrome } from './chrome/launcher.ts';
import { connectCdp } from './chrome/cdp.ts';
import type { CdpClient } from './chrome/cdp.ts';
import { HealthMonitor } from './chrome/health.ts';
import { ContentManager } from './engine/content.ts';
import { Player } from './engine/player.ts';
import { DisplayController, detectDisplays } from './system/display.ts';
import { getNetworkInterfaces } from './system/network.ts';
import { startLocalServer, setOnVideoEnded } from './system/webserver.ts';
import type { ClientConfig, DeviceCredentials } from './types.ts';
import type { ChromeProcess } from './chrome/launcher.ts';

let running = true;
let chrome: ChromeProcess | null = null;
let cdp: CdpClient | null = null;

async function main(): Promise<void> {
  console.log('[MAIN] Signage Client starting...');

  // 1. Load config
  const config = await loadConfig(Deno.args);
  console.log(`[MAIN] Server: ${config.serverUrl}, CDP port: ${config.cdpPort}`);

  // 2. Ensure device credentials
  const tempClient = new ApiClient(config.serverUrl, '');
  const creds = await ensureCredentials(config, tempClient);
  const client = new ApiClient(config.serverUrl, creds.apiKey);

  // 3. Launch Chrome or connect to existing
  const existingChrome = await findExistingChrome(config.cdpPort);
  if (existingChrome) {
    console.log('[MAIN] Found existing Chrome instance');
  } else {
    chrome = await launchChrome(config);
  }

  // 4. Establish CDP connection
  cdp = await connectCdp(config.cdpPort);
  console.log('[MAIN] CDP connected');

  // 5. Start local web server
  startLocalServer(config.localPort);

  // 6. Detect connected displays
  const displays = await detectDisplays();
  const connectedDisplays = displays.filter((d) => d.connected);
  console.log(`[MAIN] Displays: ${connectedDisplays.length} connected (${connectedDisplays.map((d) => d.name).join(', ') || 'none'})`);

  // 7. Set up components
  const display = new DisplayController();
  const health = new HealthMonitor(cdp);
  const contentManager = new ContentManager(config, client);
  const player = new Player(cdp, health, display);
  player.setDeviceInfo(creds.deviceId, config.serverUrl, config.localPort);

  // 7. Wire up video ended callback
  setOnVideoEnded(() => player.skipToNext());

  // 6. Set up WebSocket for push notifications
  const wsConnection = new WebSocketConnection(config.serverUrl, creds.apiKey, async (event) => {
    console.log(`[MAIN] WS event: ${event.type}`);
    if (event.type === 'content_updated' || event.type === 'campaign_changed') {
      // Small delay to let the DB transaction complete
      await new Promise((r) => setTimeout(r, 500));
      const updated = await contentManager.fetchContent();
      if (updated) {
        player.setCampaign(updated);
      } else {
        player.setStatusMessage(contentManager.statusMessage);
        player.setCampaign(null);
      }
    } else if (event.type === 'device_released') {
      player.setCampaign(null);
      player.setStatusMessage('Device released from tenant');
    }
  });
  wsConnection.connect();

  // 7. Handle CDP crashes and disconnects
  setupRecovery(config, creds, client, health, player, contentManager);

  // 8. Fetch content
  try {
    const campaign = await contentManager.fetchContent();
    if (campaign) {
      player.setCampaign(campaign);
    } else {
      player.setStatusMessage(contentManager.statusMessage);
    }
  } catch (error) {
    if ((error as Error & { status?: number }).status === 401) {
      await handleAuthFailure(config, client, creds, wsConnection);
    }
    player.setStatusMessage('Waiting for content');
  }

  // 9. Start all loops
  player.start(config.playerTickInterval);
  health.start(config.healthCheckInterval);

  // 10. Start heartbeat
  const heartbeatId = setInterval(async () => {
    try {
      await client.ping(creds.deviceId, Deno.hostname(), getNetworkInterfaces(), displays);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        await handleAuthFailure(config, client, creds, wsConnection);
      }
    }
  }, config.heartbeatInterval);

  // 11. Content refresh callback
  const originalFetch = contentManager.fetchContent.bind(contentManager);
  const refreshInterval = setInterval(async () => {
    try {
      const updated = await originalFetch();
      if (updated) {
        player.setCampaign(updated);
      } else {
        player.setStatusMessage(contentManager.statusMessage);
        player.setCampaign(null);
      }
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) {
        await handleAuthFailure(config, client, creds, wsConnection);
      }
    }
  }, config.contentRefreshInterval);

  // 12. Shutdown handling
  const shutdown = () => {
    if (!running) return;
    running = false;
    console.log('\n[MAIN] Shutting down...');
    player.stop();
    health.stop();
    contentManager.stopAutoRefresh();
    clearInterval(heartbeatId);
    clearInterval(refreshInterval);
    wsConnection.disconnect();
    cdp?.close();
    chrome?.kill();
    console.log('[MAIN] Goodbye');
    Deno.exit(0);
  };

  Deno.addSignalListener('SIGINT', shutdown);
  Deno.addSignalListener('SIGTERM', shutdown);

  console.log('[MAIN] Signage Client running. Press Ctrl+C to stop.');

  // Keep alive
  await new Promise(() => {});
}

function setupRecovery(
  config: ClientConfig,
  creds: DeviceCredentials,
  client: ApiClient,
  health: HealthMonitor,
  player: Player,
  contentManager: ContentManager,
): void {
  cdp!.onCrash(async () => {
    console.error('[MAIN] Page crashed, attempting reload...');
    try {
      await cdp!.reload();
    } catch {
      console.error('[MAIN] Reload after crash failed');
    }
  });

  cdp!.onDisconnect(async () => {
    if (!running) return;
    console.warn('[MAIN] CDP disconnected, attempting reconnect...');

    let delay = 1000;
    while (running) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30000);

      try {
        // Check if Chrome is still alive
        const alive = await findExistingChrome(config.cdpPort);
        if (!alive) {
          console.log('[MAIN] Chrome died, relaunching...');
          chrome = await launchChrome(config);
        }

        cdp = await connectCdp(config.cdpPort);
        health.setCdp(cdp);
        player.setCdp(cdp);
        setupRecovery(config, creds, client, health, player, contentManager);
        console.log('[MAIN] CDP reconnected');
        break;
      } catch (error) {
        console.warn('[MAIN] Reconnect failed:', error instanceof Error ? error.message : error);
      }
    }
  });
}

async function handleAuthFailure(
  config: ClientConfig,
  client: ApiClient,
  creds: DeviceCredentials,
  wsConnection: WebSocketConnection,
): Promise<void> {
  // First try challenge-response re-auth (device still exists, key rotated)
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

  // Re-auth failed (device deleted / fresh DB) — re-register
  try {
    const tempClient = new ApiClient(config.serverUrl, '');
    const newCreds = await ensureCredentials(config, tempClient, true);
    creds.deviceId = newCreds.deviceId;
    creds.apiKey = newCreds.apiKey;
    client.setApiKey(newCreds.apiKey);
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
  chrome?.kill();
  Deno.exit(1);
});
