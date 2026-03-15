import type { ClientConfig } from '../types.ts';

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
  windows: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${Deno.env.get('LOCALAPPDATA') || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    `${Deno.env.get('PROGRAMFILES') || ''}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
};

async function findChromeBinary(): Promise<string> {
  const os = Deno.build.os;
  const candidates = CHROME_PATHS[os] || CHROME_PATHS['linux'];

  for (const path of candidates) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) return path;
    } catch {
      // not found, try next
    }
  }

  // Try PATH lookup (which on Linux/macOS, where on Windows)
  const lookupCmd = os === 'windows' ? 'where' : 'which';
  const lookupNames = os === 'windows'
    ? ['chrome', 'chromium']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

  for (const name of lookupNames) {
    try {
      const cmd = new Deno.Command(lookupCmd, { args: [name], stdout: 'piped', stderr: 'null' });
      const output = await cmd.output();
      if (output.success) {
        const path = new TextDecoder().decode(output.stdout).trim().split('\n')[0];
        if (path) return path;
      }
    } catch {
      // continue
    }
  }

  throw new Error('Chrome/Chromium not found. Set SIGNAGE_CHROME_PATH or --chrome-path');
}

export interface ChromeProcess {
  process: Deno.ChildProcess;
  cdpPort: number;
  kill(): void;
}

export async function launchChrome(config: ClientConfig): Promise<ChromeProcess> {
  const chromePath = config.chromePath || await findChromeBinary();
  console.log(`[CHROME] Launching: ${chromePath}`);

  const tmpBase = Deno.build.os === 'windows'
    ? (Deno.env.get('TEMP') || Deno.env.get('TMP') || 'C:\\Temp')
    : '/tmp';
  const userDataDir = `${tmpBase}${Deno.build.os === 'windows' ? '\\' : '/'}signage-chrome-${config.cdpPort}`;

  const args = [
    `--remote-debugging-port=${config.cdpPort}`,
    '--kiosk',
    '--noerrdialogs',
    '--disable-session-crashed-bubble',
    '--disable-infobars',
    '--disable-translate',
    '--disable-features=TranslateUI',
    '--disable-background-networking',
    '--disable-sync',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  const command = new Deno.Command(chromePath, {
    args,
    stdout: 'null',
    stderr: 'null',
  });

  const process = command.spawn();

  // Wait for CDP to be ready
  await waitForCdp(config.cdpPort);

  console.log(`[CHROME] Ready on CDP port ${config.cdpPort}`);

  return {
    process,
    cdpPort: config.cdpPort,
    kill() {
      try {
        process.kill('SIGTERM');
      } catch {
        // already dead
      }
    },
  };
}

async function waitForCdp(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Chrome CDP not ready after ${timeoutMs}ms`);
}

export async function findExistingChrome(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}
