export interface CdpClient {
  navigate(url: string): Promise<void>;
  reload(): Promise<void>;
  evaluate(expression: string, timeoutMs?: number): Promise<unknown>;
  close(): void;
  onCrash(handler: () => void): void;
  onDisconnect(handler: () => void): void;
  readonly connected: boolean;
}

export async function connectCdp(port: number): Promise<CdpClient> {
  // Get the first available page target
  const res = await fetch(`http://localhost:${port}/json`);
  const targets = await res.json() as Array<{ webSocketDebuggerUrl: string; type: string }>;
  const page = targets.find((t) => t.type === 'page');

  if (!page) {
    throw new Error('No page target found');
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let messageId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let crashHandler: (() => void) | null = null;
  let disconnectHandler: (() => void) | null = null;
  let isConnected = false;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('CDP WebSocket connection timeout')), 10000);
    ws.onopen = () => {
      clearTimeout(timeout);
      isConnected = true;
      resolve();
    };
    ws.onerror = (e) => {
      clearTimeout(timeout);
      reject(new Error(`CDP WebSocket error: ${e}`));
    };
  });

  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));

    // Handle responses to our commands
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)!;
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(msg.error.message));
      } else {
        resolve(msg.result);
      }
    }

    // Handle crash events
    if (msg.method === 'Inspector.targetCrashed') {
      console.error('[CDP] Target crashed!');
      crashHandler?.();
    }
  };

  ws.onclose = () => {
    isConnected = false;
    // Reject all pending
    for (const [, { reject }] of pending) {
      reject(new Error('CDP connection closed'));
    }
    pending.clear();
    disconnectHandler?.();
  };

  ws.onerror = () => {
    isConnected = false;
  };

  function send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!isConnected) {
        reject(new Error('CDP not connected'));
        return;
      }
      const id = messageId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Enable crash detection
  await send('Inspector.enable');

  return {
    get connected() {
      return isConnected;
    },

    async navigate(url: string): Promise<void> {
      await send('Page.navigate', { url });
    },

    async reload(): Promise<void> {
      await send('Page.reload');
    },

    async evaluate(expression: string, timeoutMs = 5000): Promise<unknown> {
      const result = await Promise.race([
        send('Runtime.evaluate', { expression, returnByValue: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Evaluate timeout')), timeoutMs)
        ),
      ]);
      return result;
    },

    close(): void {
      isConnected = false;
      try {
        ws.close();
      } catch {
        // ignore
      }
    },

    onCrash(handler: () => void): void {
      crashHandler = handler;
    },

    onDisconnect(handler: () => void): void {
      disconnectHandler = handler;
    },
  };
}
