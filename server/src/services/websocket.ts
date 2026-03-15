import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { playlistSchedules } from '../db/schema/index.ts';

interface WsEvent {
  type: 'content_updated' | 'campaign_changed' | 'device_released';
  timestamp: string;
}

interface DeviceConnection {
  ws: WebSocket;
  deviceId: string;
  tenantId: string | null;
  campaignIds: Set<string>;
}

class WebSocketManager {
  private connections = new Map<string, DeviceConnection>();
  private pingIntervalId: number | null = null;

  start(): void {
    // Heartbeat every 30s
    this.pingIntervalId = setInterval(() => this.pingAll(), 30000);
    console.log('[WS] WebSocket manager started');
  }

  stop(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    this.closeAll();
  }

  addConnection(deviceId: string, tenantId: string | null, campaignIds: string[], ws: WebSocket): void {
    // Close existing connection for this device
    const existing = this.connections.get(deviceId);
    if (existing) {
      try { existing.ws.close(1000, 'Replaced by new connection'); } catch { /* ignore */ }
    }

    this.connections.set(deviceId, { ws, deviceId, tenantId, campaignIds: new Set(campaignIds) });

    ws.onclose = () => {
      this.connections.delete(deviceId);
      console.log(`[WS] Device ${deviceId} disconnected (${this.connections.size} connected)`);
    };

    ws.onerror = () => {
      this.connections.delete(deviceId);
    };

    ws.onmessage = (event) => {
      // Handle client pings
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch { /* ignore malformed messages */ }
    };

    console.log(`[WS] Device ${deviceId} connected (${this.connections.size} connected)`);
  }

  notifyDevice(deviceId: string, event: WsEvent): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      console.log(`[WS] Sending ${event.type} to device ${deviceId}`);
      this.send(conn.ws, event);
    } else {
      console.log(`[WS] Device ${deviceId} not connected, cannot send ${event.type}`);
    }
  }

  notifyDevicesByCampaign(campaignId: string): void {
    const event: WsEvent = {
      type: 'content_updated',
      timestamp: new Date().toISOString(),
    };

    for (const conn of this.connections.values()) {
      if (conn.campaignIds.has(campaignId)) {
        this.send(conn.ws, event);
      }
    }
  }

  async notifyDevicesByPlaylist(playlistId: string): Promise<void> {
    try {
      // Find playlist group IDs that reference this playlist
      const schedules = await db.query.playlistSchedules.findMany({
        where: eq(playlistSchedules.playlistId, playlistId),
      });

      const campaignIds = new Set(schedules.map((s) => s.playlistGroupId));
      console.log(`[WS] Playlist ${playlistId} used in campaigns: [${[...campaignIds].join(', ')}]`);
      console.log(`[WS] Connected devices: ${[...this.connections.entries()].map(([id, c]) => `${id}(campaigns=[${[...c.campaignIds].join(',')}])`).join(', ')}`);

      const event: WsEvent = {
        type: 'content_updated',
        timestamp: new Date().toISOString(),
      };

      let notified = 0;
      for (const conn of this.connections.values()) {
        for (const connCampaignId of conn.campaignIds) {
          if (campaignIds.has(connCampaignId)) {
            this.send(conn.ws, event);
            notified++;
            break; // Only notify once per device
          }
        }
      }
      console.log(`[WS] Notified ${notified} devices about playlist change`);
    } catch (error) {
      console.error('[WS] Error notifying by playlist:', error instanceof Error ? error.message : error);
    }
  }

  updateDeviceCampaigns(deviceId: string, displayCampaigns: Array<{ campaignId: string }>): void {
    const conn = this.connections.get(deviceId);
    if (conn) {
      conn.campaignIds = new Set(displayCampaigns.map((dc) => dc.campaignId));
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  closeAll(): void {
    for (const conn of this.connections.values()) {
      try { conn.ws.close(1001, 'Server shutting down'); } catch { /* ignore */ }
    }
    this.connections.clear();
    console.log('[WS] All connections closed');
  }

  private send(ws: WebSocket, event: WsEvent): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    } catch { /* ignore send errors on dead sockets */ }
  }

  private pingAll(): void {
    for (const [deviceId, conn] of this.connections) {
      try {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        } else {
          this.connections.delete(deviceId);
        }
      } catch {
        this.connections.delete(deviceId);
      }
    }
  }
}

export const wsManager = new WebSocketManager();
