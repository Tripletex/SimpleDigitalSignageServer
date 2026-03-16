import type { Campaign, PlaylistItem } from '../types.ts';
import type { CdpClient } from '../chrome/cdp.ts';
import { HealthMonitor } from '../chrome/health.ts';
import { findActiveSchedule } from './scheduler.ts';
import { DisplayController } from '../system/display.ts';

export class Player {
  private cdp: CdpClient;
  private health: HealthMonitor;
  private display: DisplayController;
  private campaign: Campaign | null = null;
  private deviceId: string = '';
  private serverUrl: string = '';
  private localPort: number = 8080;
  private _statusMessage: string = 'Waiting for content';
  private intervalId: number | null = null;
  private _displayName: string = '';

  private currentScheduleId: string | null = null;
  private currentItemIndex = 0;
  private itemStartTime = 0;
  private currentUrl: string | null = null;
  private showingStatusPage = false;

  constructor(cdp: CdpClient, health: HealthMonitor, display: DisplayController) {
    this.cdp = cdp;
    this.health = health;
    this.display = display;
  }

  /** Tag for log messages to identify which display this player serves. */
  private get tag(): string {
    return this._displayName ? `[PLAYER:${this._displayName}]` : '[PLAYER]';
  }

  setDisplayName(name: string): void {
    this._displayName = name;
  }

  setDeviceInfo(deviceId: string, serverUrl: string, localPort?: number): void {
    this.deviceId = deviceId;
    this.serverUrl = serverUrl;
    if (localPort) this.localPort = localPort;
  }

  setCdp(cdp: CdpClient): void {
    this.cdp = cdp;
  }

  setStatusMessage(message: string): void {
    this._statusMessage = message;
    if (this.showingStatusPage) {
      this.showingStatusPage = false; // Force refresh on next tick
    }
  }

  setCampaign(campaign: Campaign | null): void {
    this.campaign = campaign;
    if (campaign) {
      this.showingStatusPage = false;
    }
  }

  start(intervalMs: number): void {
    this.stop();
    this.intervalId = setInterval(() => this.tick(), intervalMs);
    console.log(`${this.tag} Started (tick every ${intervalMs / 1000}s)`);
    // Run immediately
    this.tick();
  }

  skipToNext(): void {
    console.log(`${this.tag} Video ended, skipping to next item`);
    const items = this.getCurrentItems();
    if (items && items.length > 0) {
      this.currentItemIndex = (this.currentItemIndex + 1) % items.length;
      this.itemStartTime = Date.now();
      this.health.resetFailures();
      const nextItem = items[this.currentItemIndex];
      this.playItem(nextItem);
    }
  }

  private getCurrentItems(): PlaylistItem[] | null {
    if (!this.campaign) return null;
    const activeSchedule = findActiveSchedule(this.campaign.schedules);
    if (!activeSchedule?.playlist?.items?.length) return null;
    return activeSchedule.playlist.items.sort((a, b) => a.position - b.position);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (!this.cdp.connected) return;

    if (!this.campaign) {
      if (!this.showingStatusPage) {
        await this.showStatusPage(this._statusMessage);
      }
      return;
    }

    const activeSchedule = findActiveSchedule(this.campaign.schedules);

    if (!activeSchedule) {
      if (!this.showingStatusPage) {
        await this.showStatusPage('No active schedule');
      }
      this.currentScheduleId = null;
      return;
    }

    this.showingStatusPage = false;

    const playlist = activeSchedule.playlist;
    if (!playlist || !playlist.items || playlist.items.length === 0) return;

    // Schedule changed — reset to beginning
    if (activeSchedule.id !== this.currentScheduleId) {
      console.log(`${this.tag} Schedule changed to: ${playlist.name}`);
      this.currentScheduleId = activeSchedule.id;
      this.currentItemIndex = 0;
      this.itemStartTime = Date.now();
    }

    const items = playlist.items.sort((a, b) => a.position - b.position);
    const currentItem = items[this.currentItemIndex];
    if (!currentItem) return;

    const elapsed = (Date.now() - this.itemStartTime) / 1000;

    if (currentItem.duration > 0 && elapsed >= currentItem.duration) {
      // Advance to next item
      this.currentItemIndex = (this.currentItemIndex + 1) % items.length;
      this.itemStartTime = Date.now();
      this.health.resetFailures();
      const nextItem = items[this.currentItemIndex];
      await this.playItem(nextItem);
    } else if (this.itemStartTime === Date.now()) {
      // First tick for this item
      await this.playItem(currentItem);
    }
  }

  private async playItem(item: PlaylistItem): Promise<void> {
    if (this.health.shouldSkipUrl()) {
      console.warn(`${this.tag} Skipping item due to health failures: ${item.data?.location || item.type}`);
      this.health.resetFailures();
      this.currentItemIndex = (this.currentItemIndex + 1) % (this.campaign?.schedules
        .find((s) => s.id === this.currentScheduleId)?.playlist.items.length || 1);
      this.itemStartTime = Date.now();
      return;
    }

    // Set cookies and headers before navigating
    await this.applyBrowserConfig(item);

    const itemType = item.type.toLowerCase();

    if (itemType === 'sleep') {
      console.log(`${this.tag} Sleep for ${item.duration}s`);
      await this.navigateTo('about:blank');
      this.display.off();
    } else if (itemType === 'image' && item.data?.location) {
      console.log(`${this.tag} Show image: ${item.data.location} (${item.duration}s)`);
      this.display.on();
      await this.showImage(item.data.location, item.data.fit, item.data.bgColor);
    } else if (itemType === 'youtube' && item.data?.location) {
      const dur = item.duration > 0 ? `${item.duration}s` : 'video length';
      console.log(`${this.tag} Show YouTube: ${item.data.location} (${dur})`);
      this.display.on();
      await this.showYoutube(item.data.location, item.data.muted, item.data.loop, item.data.loopCount);
    } else if (itemType === 'url' && item.data?.location) {
      console.log(`${this.tag} Navigate to: ${item.data.location} (${item.duration}s)`);
      this.display.on();
      await this.navigateTo(item.data.location);
    }
  }

  private async applyBrowserConfig(item: PlaylistItem): Promise<void> {
    try {
      // Set cookies (these persist in Chrome, so duplicates are harmless)
      if (item.data?.cookies?.length) {
        // If no domain specified, derive from the URL
        const url = item.data.location;
        let defaultDomain: string | undefined;
        try {
          defaultDomain = new URL(url).hostname;
        } catch { /* ignore */ }

        const cookies = item.data.cookies.map((c) => ({
          ...c,
          domain: c.domain || defaultDomain,
        }));
        await this.cdp.setCookies(cookies);
        console.log(`${this.tag} Set ${cookies.length} cookie(s) for ${defaultDomain || 'unknown'}`);
      }

      // Set extra headers (replaced per item, cleared if none)
      await this.cdp.setExtraHeaders(item.data?.headers || null);
      if (item.data?.headers && Object.keys(item.data.headers).length > 0) {
        console.log(`${this.tag} Set ${Object.keys(item.data.headers).length} extra header(s)`);
      }
    } catch (error) {
      console.warn(`${this.tag} Failed to apply browser config:`, error instanceof Error ? error.message : error);
    }
  }

  private async navigateTo(url: string): Promise<void> {
    if (url === this.currentUrl) return;
    try {
      await this.cdp.navigate(url);
      this.currentUrl = url;
    } catch (error) {
      console.error(`${this.tag} Navigation failed:`, error instanceof Error ? error.message : error);
    }
  }

  private async showYoutube(youtubeUrl: string, muted?: boolean, loop?: boolean, loopCount?: number): Promise<void> {
    // Extract video/playlist ID and build local embed URL
    const params = new URLSearchParams();
    try {
      const parsed = new URL(youtubeUrl);
      const listId = parsed.searchParams.get('list');
      let videoId = parsed.searchParams.get('v');

      if (!videoId && parsed.hostname === 'youtu.be') {
        videoId = parsed.pathname.slice(1);
      }
      if (!videoId && parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2];
      }
      if (!videoId && parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2];
      }

      if (videoId) params.set('v', videoId);
      if (listId) params.set('list', listId);
    } catch {
      await this.navigateTo(youtubeUrl);
      return;
    }

    if (!params.has('v') && !params.has('list')) {
      await this.navigateTo(youtubeUrl);
      return;
    }

    if (muted) params.set('muted', '1');
    if (loop) {
      params.set('loop', '1');
      if (loopCount && loopCount > 1) params.set('loopCount', String(loopCount));
    }

    const embedUrl = `http://127.0.0.1:${this.localPort}/embed/youtube?${params}`;
    console.log(`${this.tag} YouTube via server: ${embedUrl}`);

    try {
      await this.cdp.navigate(embedUrl);
      this.currentUrl = youtubeUrl;
    } catch (error) {
      console.error(`${this.tag} YouTube navigation failed:`, error instanceof Error ? error.message : error);
    }
  }

  private async showImage(imageUrl: string, fit?: string, bgColor?: string): Promise<void> {
    const params = new URLSearchParams();
    params.set('src', imageUrl);
    if (fit) params.set('fit', fit);
    if (bgColor) params.set('bg', bgColor);

    const embedUrl = `http://127.0.0.1:${this.localPort}/embed/image?${params}`;

    try {
      await this.cdp.navigate(embedUrl);
      this.currentUrl = imageUrl;
    } catch (error) {
      console.error(`${this.tag} Image navigation failed:`, error instanceof Error ? error.message : error);
    }
  }

  private async showStatusPage(status: string): Promise<void> {
    this.showingStatusPage = true;
    this.currentUrl = null;

    const params = new URLSearchParams();
    params.set('deviceId', this.deviceId);
    params.set('server', this.serverUrl);
    params.set('message', status);
    const embedUrl = `http://127.0.0.1:${this.localPort}/embed/status?${params}`;

    try {
      await this.cdp.navigate(embedUrl);
      this.display.on();
      console.log(`${this.tag} Showing status page: ${status}`);
    } catch (error) {
      console.error(`${this.tag} Failed to show status page:`, error instanceof Error ? error.message : error);
    }
  }
}
