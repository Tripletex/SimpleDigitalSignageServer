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
      await this.showImage(item.data.location);
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

  private async showImage(imageUrl: string): Promise<void> {
    const html = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signage</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
  img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
</style></head>
<body><img src="${imageUrl.replace(/"/g, '&quot;')}" /></body></html>`)}`;

    try {
      await this.cdp.navigate(html);
      this.currentUrl = imageUrl;
    } catch (error) {
      console.error('[PLAYER] Image navigation failed:', error instanceof Error ? error.message : error);
    }
  }

  private async showStatusPage(status: string): Promise<void> {
    this.showingStatusPage = true;
    this.currentUrl = null;

    const html = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signage Client</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1a1a2e; color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; text-align: center;
  }
  .container { max-width: 600px; padding: 2rem; }
  h1 { font-size: 1.5rem; color: #7c8dff; margin-bottom: 1.5rem; }
  .device-id {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 2rem; color: #fff;
    background: #16213e; border: 2px solid #7c8dff;
    border-radius: 12px; padding: 1rem 1.5rem;
    margin: 1rem 0; letter-spacing: 0.05em;
    word-break: break-all; user-select: all;
  }
  .status { font-size: 1rem; color: #888; margin-top: 1.5rem; }
  .server { font-size: 0.85rem; color: #555; margin-top: 0.5rem; }
</style></head>
<body><div class="container">
  <h1>Signage Client</h1>
  <div>Device ID</div>
  <div class="device-id">${this.deviceId}</div>
  <div class="status">${status}</div>
  <div class="server">Server: ${this.serverUrl}</div>
</div></body></html>`)}`;

    try {
      await this.cdp.navigate(html);
      this.display.on();
      console.log(`[PLAYER] Showing status page: ${status}`);
    } catch (error) {
      console.error('[PLAYER] Failed to show status page:', error instanceof Error ? error.message : error);
    }
  }
}
