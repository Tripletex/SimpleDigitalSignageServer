import type { ClientConfig } from './types.ts';
import { storage } from './system/storage.ts';

const DEFAULT_CONFIG: ClientConfig = {
  serverUrl: 'http://localhost:4000',
  configDir: getDefaultConfigDir(),
  cdpPort: 9222,
  contentRefreshInterval: 5 * 60 * 1000,  // 5 min
  healthCheckInterval: 30 * 1000,          // 30s
  heartbeatInterval: 60 * 1000,            // 60s
  playerTickInterval: 5 * 1000,            // 5s
  localPort: 8080,                         // local web server
};

function getDefaultConfigDir(): string {
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '/tmp';
  return `${home}/.config/signage-client`;
}

export async function loadConfig(args: string[]): Promise<ClientConfig> {
  const config = { ...DEFAULT_CONFIG };
  config.configDir = Deno.env.get('SIGNAGE_CONFIG_DIR') || config.configDir;

  // Load from config file if exists
  const fileConfig = await storage.readJson<Partial<ClientConfig>>(
    `${config.configDir}/config.json`,
  );
  if (fileConfig) {
    Object.assign(config, fileConfig);
  }

  // Override from env vars
  const serverUrl = Deno.env.get('SIGNAGE_SERVER_URL');
  if (serverUrl) config.serverUrl = serverUrl;

  const chromePath = Deno.env.get('SIGNAGE_CHROME_PATH');
  if (chromePath) config.chromePath = chromePath;

  const cdpPort = Deno.env.get('SIGNAGE_CDP_PORT');
  if (cdpPort) config.cdpPort = parseInt(cdpPort, 10);

  // Parse CLI args (--server-url=..., --chrome-path=..., --cdp-port=...)
  for (const arg of args) {
    const [key, value] = arg.split('=', 2);
    if (!value) continue;
    switch (key) {
      case '--server-url': config.serverUrl = value; break;
      case '--chrome-path': config.chromePath = value; break;
      case '--cdp-port': config.cdpPort = parseInt(value, 10); break;
      case '--config-dir': config.configDir = value; break;
    }
  }

  return config;
}
