export type WsEventType = 'content_updated' | 'campaign_changed' | 'device_released' | 'pong';

export interface WsEvent {
  type: WsEventType;
  timestamp: string;
}

export type WsEventHandler = (event: WsEvent) => void;

export class WebSocketConnection {
  private serverUrl: string;
  private apiKey: string;
  private ws: WebSocket | null = null;
  private onEvent: WsEventHandler;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 60000;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private _connected = false;
  private shouldReconnect = true;

  constructor(serverUrl: string, apiKey: string, onEvent: WsEventHandler) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.onEvent = onEvent;
  }

  get connected(): boolean {
    return this._connected;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    if (this.ws) {
      try { this.ws.close(1000, 'Client disconnect'); } catch { /* ignore */ }
      this.ws = null;
    }
    this._connected = false;
  }

  private doConnect(): void {
    if (this.ws) {
      try { this.ws.close(); } catch { /* ignore */ }
    }

    const wsUrl = this.serverUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:')
      .replace(/\/+$/, '');

    const url = `${wsUrl}/api/device/ws?apiKey=${encodeURIComponent(this.apiKey)}`;

    try {
      this.ws = new WebSocket(url);
    } catch (error) {
      console.warn('[WS] Failed to create WebSocket:', error instanceof Error ? error.message : error);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 1000;
      console.log('[WS] Connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WsEvent;
        if (msg.type && msg.type !== 'pong') {
          console.log(`[WS] Received: ${msg.type}`);
          this.onEvent(msg);
        }
      } catch { /* ignore malformed messages */ }
    };

    this.ws.onclose = (event) => {
      this._connected = false;
      this.clearPing();

      if (event.code === 4001 || event.code === 1008) {
        console.error('[WS] Auth rejected, not reconnecting');
        return;
      }

      if (this.shouldReconnect) {
        console.log(`[WS] Disconnected (code: ${event.code}), reconnecting...`);
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.clearTimers();

    console.log(`[WS] Reconnecting in ${this.reconnectDelay / 1000}s...`);
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, this.reconnectDelay) as unknown as number;

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch { /* ignore */ }
      }
    }, 25000) as unknown as number;
  }

  private clearPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
