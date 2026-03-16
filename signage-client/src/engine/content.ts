import type { Campaign, ClientConfig } from '../types.ts';
import { ApiClient } from '../api/client.ts';
import { storage } from '../system/storage.ts';

export class ContentManager {
  private config: ClientConfig;
  private client: ApiClient;
  /** Per-display campaign mapping */
  private displayCampaigns: Record<string, Campaign | null> = {};
  private intervalId: number | null = null;
  private _statusMessage: string = 'Waiting for content';

  constructor(config: ClientConfig, client: ApiClient) {
    this.config = config;
    this.client = client;
  }

  /** Get the campaign for a specific display. Falls back to first available. */
  getCampaign(displayName?: string): Campaign | null {
    if (displayName && this.displayCampaigns[displayName] !== undefined) {
      return this.displayCampaigns[displayName];
    }
    // Fallback: return first available campaign
    const entries = Object.values(this.displayCampaigns);
    return entries.find((c) => c !== null) ?? null;
  }

  /** Get all display→campaign mappings. */
  getDisplayCampaigns(): Record<string, Campaign | null> {
    return { ...this.displayCampaigns };
  }

  get statusMessage(): string {
    return this._statusMessage;
  }

  async fetchContent(): Promise<Campaign | null> {
    try {
      const response = await this.client.fetchContent();
      if (response.success && response.displays) {
        // Multi-display format
        this.displayCampaigns = {};
        for (const [displayName, content] of Object.entries(response.displays)) {
          this.displayCampaigns[displayName] = content.campaign;
        }
        this._statusMessage = '';

        // Cache to disk
        await storage.writeJson(
          `${this.config.configDir}/content_cache.json`,
          this.displayCampaigns,
        );

        const displayNames = Object.keys(this.displayCampaigns);
        console.log(`[CONTENT] Fetched campaigns for ${displayNames.length} display(s): ${displayNames.join(', ')}`);

        // Return first campaign for backward compat with Player
        return this.getCampaign();
      }

      // No displays assigned
      this._statusMessage = response.message || 'No campaign assigned';
      console.log(`[CONTENT] ${this._statusMessage}`);
      this.displayCampaigns = {};
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
    const cached = await storage.readJson<Record<string, Campaign | null>>(
      `${this.config.configDir}/content_cache.json`,
    );
    if (cached) {
      this.displayCampaigns = cached;
      const names = Object.keys(cached);
      console.log(`[CONTENT] Loaded from cache: ${names.length} display(s)`);
    }
    return this.getCampaign();
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
