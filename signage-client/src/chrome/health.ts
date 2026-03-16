import type { CdpClient } from './cdp.ts';
import type { HealthStatus } from '../types.ts';

const MAX_FAILURES_BEFORE_SKIP = 3;

export class HealthMonitor {
  private cdp: CdpClient;
  private intervalId: number | null = null;
  private status: HealthStatus = {
    healthy: true,
    consecutiveFailures: 0,
    lastCheck: Date.now(),
  };
  private onUnhealthy: (() => void) | null = null;

  constructor(cdp: CdpClient) {
    this.cdp = cdp;
  }

  setCdp(cdp: CdpClient): void {
    this.cdp = cdp;
    this.status.consecutiveFailures = 0;
    this.status.healthy = true;
  }

  start(intervalMs: number): void {
    this.stop();
    this.intervalId = setInterval(() => this.check(), intervalMs);
    console.log(`[HEALTH] Monitoring started (every ${intervalMs / 1000}s)`);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onUnhealthyCallback(handler: () => void): void {
    this.onUnhealthy = handler;
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  shouldSkipUrl(): boolean {
    return this.status.consecutiveFailures >= MAX_FAILURES_BEFORE_SKIP;
  }

  resetFailures(): void {
    this.status.consecutiveFailures = 0;
    this.status.healthy = true;
  }

  private async check(): Promise<void> {
    this.status.lastCheck = Date.now();

    if (!this.cdp.connected) {
      this.status.healthy = false;
      this.status.consecutiveFailures++;
      console.warn(`[HEALTH] CDP disconnected (failures: ${this.status.consecutiveFailures})`);
      this.onUnhealthy?.();
      return;
    }

    try {
      await this.cdp.evaluate('document.readyState', 5000);
      this.status.healthy = true;
      this.status.consecutiveFailures = 0;
    } catch (error) {
      this.status.consecutiveFailures++;
      this.status.healthy = false;
      console.warn(
        `[HEALTH] Check failed (failures: ${this.status.consecutiveFailures}):`,
        error instanceof Error ? error.message : error,
      );

      if (this.status.consecutiveFailures <= MAX_FAILURES_BEFORE_SKIP) {
        try {
          console.log('[HEALTH] Attempting reload...');
          await this.cdp.reload();
        } catch {
          console.error('[HEALTH] Reload failed');
          this.onUnhealthy?.();
        }
      } else {
        this.onUnhealthy?.();
      }
    }
  }
}
