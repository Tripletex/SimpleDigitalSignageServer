export interface PlaylistItem {
  id: string;
  type: string; // 'url', 'sleep', 'image', 'youtube'
  data?: {
    location: string;
    muted?: boolean;
    loop?: boolean;
    loopCount?: number;
  };
  duration: number; // seconds (0 = video determines duration)
  position: number;
}

export interface Playlist {
  id: string;
  name: string;
  items: PlaylistItem[];
}

export interface Schedule {
  id: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  days: string[]; // "mon","tue",...
  playlist: Playlist;
}

export interface Campaign {
  id: string;
  name: string;
  schedules: Schedule[];
}

export interface ContentResponse {
  success: boolean;
  campaign?: Campaign;
  message?: string;
}

export interface DeviceCredentials {
  deviceId: string;
  apiKey: string;
  serverUrl: string;
  registeredAt: string;
}

export interface ClientConfig {
  serverUrl: string;
  configDir: string;
  chromePath?: string;
  cdpPort: number;
  contentRefreshInterval: number; // ms
  healthCheckInterval: number;    // ms
  heartbeatInterval: number;      // ms
  playerTickInterval: number;     // ms
  localPort: number;              // local web server port
}

export interface NetworkInterface {
  name: string;
  ipAddress: string[];
}

export interface HealthStatus {
  healthy: boolean;
  consecutiveFailures: number;
  lastCheck: number;
}
