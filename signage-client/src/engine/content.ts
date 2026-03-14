import type { Campaign, ClientConfig } from '../types.ts';
import { ApiClient } from '../api/client.ts';
import { storage } from '../system/storage.ts';

export class ContentManager {
  private config: ClientConfig;
  private client: ApiClient;
  private campaign: Campaign | null = null;
  private intervalId: number | null = null;
  private _statusMessage: string = 'Waiting for content';

  constructor(config: ClientConfig, client: ApiClient) {
    this.config = config;
    this.client = client;
  }

  getCampaign(): Campaign | null {
    return this.campaign;
  }

  get statusMessage(): string {
    return this._statusMessage;
  }

  async fetchContent(): Promise<Campaign | null> {
    try {
      const response = await this.client.fetchContent();
      if (response.success && response.campaign) {
        this.campaign = response.campaign;
        this._statusMessage = '';
        // Cache to disk
        await storage.writeJson(
          `${this.config.configDir}/content_cache.json`,
          response.campaign,
        );
        console.log(`[CONTENT] Fetched campaign: ${response.campaign.name} (${response.campaign.schedules.length} schedules)`);
        return this.campaign;
      }
      // Server returned a specific reason — clear campaign and cache
      this._statusMessage = response.message || 'No campaign assigned';
      console.log(`[CONTENT] ${this._statusMessage}`);
      this.campaign = null;
      await storage.remove(`${this.config.configDir}/content_cache.json`);
      return null;
    } catch (error) {
      // Re-throw 401 so callers can trigger re-registration
      if ((error as Error & { status?: number }).status === 401) {
        console.warn('[CONTENT] API key rejected');
        throw error;
      }
      console.warn(
        '[CONTENT] Fetch failed, using cache:',
        error instanceof Error ? error.message : error,
      );
      return this.loadFromCache();
    }
  }

  async loadFromCache(): Promise<Campaign | null> {
    const cached = await storage.readJson<Campaign>(
      `${this.config.configDir}/content_cache.json`,
    );
    if (cached) {
      this.campaign = cached;
      console.log(`[CONTENT] Loaded from cache: ${cached.name}`);
    }
    return this.campaign;
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.intervalId = setInterval(
      () => this.fetchContent(),
      this.config.contentRefreshInterval,
    );
    console.log(
      `[CONTENT] Auto-refresh started (every ${this.config.contentRefreshInterval / 1000}s)`,
    );
  }

  stopAutoRefresh(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
