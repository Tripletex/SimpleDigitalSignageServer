import type { ContentResponse, NetworkInterface, DisplayInfo } from '../types.ts';

export class ApiClient {
  private serverUrl: string;
  private apiKey: string;
  private maxRetries = 3;
  private baseDelay = 1000;

  constructor(serverUrl: string, apiKey: string) {
    this.serverUrl = serverUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async fetchContent(): Promise<ContentResponse> {
    const res = await this.authenticatedFetch('/api/device/content');
    return await res.json() as ContentResponse;
  }

  async ping(deviceId: string, name: string, networks: NetworkInterface[], displays?: DisplayInfo[]): Promise<void> {
    await this.request('/api/device/ping', {
      method: 'POST',
      body: JSON.stringify({ id: deviceId, name, networks, displays }),
    });
  }

  async register(publicKey: string, deviceType?: string, hardwareId?: string): Promise<{
    id: string;
    apiKey: string;
    registrationTime: string;
  }> {
    const res = await fetch(`${this.serverUrl}/api/device/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey, deviceType, hardwareId }),
    });
    if (!res.ok) {
      throw new Error(`Registration failed: ${res.status} ${await res.text()}`);
    }
    return res.json();
  }

  async requestChallenge(deviceId: string): Promise<{ challenge: string; expires: number }> {
    const res = await fetch(`${this.serverUrl}/api/device-auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    if (!res.ok) {
      throw new Error(`Challenge request failed: ${res.status}`);
    }
    return res.json();
  }

  async verifyChallenge(deviceId: string, challenge: string, signature: string): Promise<{
    success: boolean;
    apiKey?: string;
  }> {
    const res = await fetch(`${this.serverUrl}/api/device-auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, challenge, signature }),
    });
    if (!res.ok) {
      throw new Error(`Challenge verification failed: ${res.status}`);
    }
    return res.json();
  }

  private async authenticatedFetch(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${this.serverUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...init?.headers,
      },
    });

    if (res.status === 401) {
      const err = new Error('API key rejected');
      (err as Error & { status: number }).status = 401;
      throw err;
    }

    return res;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), 30000);
        await new Promise((r) => setTimeout(r, delay));
      }

      try {
        const res = await fetch(`${this.serverUrl}${path}`, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            ...init?.headers,
          },
        });

        if (res.status === 401) {
          const err = new Error('API key rejected');
          (err as Error & { status: number }).status = 401;
          throw err;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }

        return await res.json() as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if ((lastError as Error & { status?: number }).status === 401) {
          throw lastError; // Don't retry auth failures
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }
}
