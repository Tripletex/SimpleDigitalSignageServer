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
    console.log(`[PLAYER] Started (tick every ${intervalMs / 1000}s)`);
    // Run immediately
    this.tick();
  }

  skipToNext(): void {
    console.log('[PLAYER] Video ended, skipping to next item');
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
      console.log(`[PLAYER] Schedule changed to: ${playlist.name}`);
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
      console.warn(`[PLAYER] Skipping item due to health failures: ${item.data?.location || item.type}`);
      this.health.resetFailures();
      this.currentItemIndex = (this.currentItemIndex + 1) % (this.campaign?.schedules
        .find((s) => s.id === this.currentScheduleId)?.playlist.items.length || 1);
      this.itemStartTime = Date.now();
      return;
    }

    const itemType = item.type.toLowerCase();

    if (itemType === 'sleep') {
      console.log(`[PLAYER] Sleep for ${item.duration}s`);
      await this.navigateTo('about:blank');
      this.display.off();
    } else if (itemType === 'image' && item.data?.location) {
      console.log(`[PLAYER] Show image: ${item.data.location} (${item.duration}s)`);
      this.display.on();
      await this.showImage(item.data.location, item.data.fit, item.data.bgColor);
    } else if (itemType === 'youtube' && item.data?.location) {
      const dur = item.duration > 0 ? `${item.duration}s` : 'video length';
      console.log(`[PLAYER] Show YouTube: ${item.data.location} (${dur})`);
      this.display.on();
      await this.showYoutube(item.data.location, item.data.muted, item.data.loop, item.data.loopCount);
    } else if (itemType === 'url' && item.data?.location) {
      console.log(`[PLAYER] Navigate to: ${item.data.location} (${item.duration}s)`);
      this.display.on();
      await this.navigateTo(item.data.location);
    }
  }

  private async navigateTo(url: string): Promise<void> {
    if (url === this.currentUrl) return;
    try {
      await this.cdp.navigate(url);
      this.currentUrl = url;
    } catch (error) {
      console.error('[PLAYER] Navigation failed:', error instanceof Error ? error.message : error);
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
    console.log(`[PLAYER] YouTube via server: ${embedUrl}`);

    try {
      await this.cdp.navigate(embedUrl);
      this.currentUrl = youtubeUrl;
    } catch (error) {
      console.error('[PLAYER] YouTube navigation failed:', error instanceof Error ? error.message : error);
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
      console.error('[PLAYER] Image navigation failed:', error instanceof Error ? error.message : error);
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
      console.log(`[PLAYER] Showing status page: ${status}`);
    } catch (error) {
      console.error('[PLAYER] Failed to show status page:', error instanceof Error ? error.message : error);
    }
  }
}
