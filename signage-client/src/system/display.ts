import type { DisplayInfo } from '../types.ts';

const PLATFORM = Deno.build.os;

/**
 * Detect connected displays.
 * - Linux: /sys/class/drm/ (no X required), falls back to xrandr
 * - macOS: system_profiler SPDisplaysDataType
 * - Windows: wmic or PowerShell
 */
export async function detectDisplays(): Promise<DisplayInfo[]> {
  switch (PLATFORM) {
    case 'linux':
      return await detectLinux();
    case 'darwin':
      return await detectMacOS();
    case 'windows':
      return await detectWindows();
    default:
      console.warn(`[DISPLAY] Unknown platform: ${PLATFORM}, returning default display`);
      return [{ name: 'default', connected: true, primary: true }];
  }
}

// ---------------------------------------------------------------------------
// Linux: DRM subsystem first (works without X), fallback to xrandr
// ---------------------------------------------------------------------------

async function detectLinux(): Promise<DisplayInfo[]> {
  const displays = await detectLinuxDrm();
  if (displays.length > 0) return displays;
  return await detectLinuxXrandr();
}

async function detectLinuxDrm(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];
  try {
    const cmd = new Deno.Command('bash', {
      args: ['-c', 'for d in /sys/class/drm/card*-*/; do echo "$(basename $d)|$(cat $d/status 2>/dev/null)|$(head -1 $d/modes 2>/dev/null)"; done'],
      stdout: 'piped',
      stderr: 'piped',
    });
    const output = await cmd.output();
    const text = new TextDecoder().decode(output.stdout).trim();
    if (!text) return displays;

    let hasPrimary = false;
    for (const line of text.split('\n')) {
      const [rawName, status, mode] = line.split('|');
      if (!rawName || !status) continue;

      // Convert DRM name (card1-HDMI-A-1) to friendly name (HDMI-1)
      const connectorMatch = rawName.match(/card\d+-(.+)/);
      if (!connectorMatch) continue;
      const displayName = connectorMatch[1].replace('-A-', '-').replace('-B-', '-');

      const connected = status.trim() === 'connected';
      const primary = connected && !hasPrimary;
      if (primary) hasPrimary = true;

      displays.push({
        name: displayName,
        connected,
        primary,
        resolution: (connected && mode?.trim()) ? mode.trim() : undefined,
      });
    }
  } catch { /* DRM not available */ }
  return displays;
}

async function detectLinuxXrandr(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];
  try {
    const cmd = new Deno.Command('xrandr', { stdout: 'piped', stderr: 'piped' });
    const output = await cmd.output();
    if (!output.success) return displays;

    const text = new TextDecoder().decode(output.stdout);
    // "HDMI-1 connected primary 1920x1080+0+0 ..."
    // "HDMI-2 disconnected (normal left inverted right x axis y axis)"
    const regex = /^(\S+)\s+(connected|disconnected)\s*(primary)?\s*(?:(\d+x\d+))?/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      displays.push({
        name: match[1],
        connected: match[2] === 'connected',
        primary: match[3] === 'primary',
        resolution: match[4],
      });
    }
  } catch { /* xrandr not available */ }
  return displays;
}

// ---------------------------------------------------------------------------
// macOS: system_profiler SPDisplaysDataType
// ---------------------------------------------------------------------------

async function detectMacOS(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];
  try {
    const cmd = new Deno.Command('system_profiler', {
      args: ['-json', 'SPDisplaysDataType'],
      stdout: 'piped',
      stderr: 'piped',
    });
    const output = await cmd.output();
    if (!output.success) return displays;

    const data = JSON.parse(new TextDecoder().decode(output.stdout));
    const gpus = data.SPDisplaysDataType || [];

    let isFirst = true;
    for (const gpu of gpus) {
      const monitors = gpu.spdisplays_ndrvs || [];
      for (const monitor of monitors) {
        const name = monitor._name || 'Unknown';
        const resolutionStr = monitor._spdisplays_resolution || '';
        // Parse "1920 x 1080 @ 60 Hz" or "2560 x 1440 (QHD/WQHD) @ 60Hz"
        const resParts = resolutionStr.match(/(\d+)\s*x\s*(\d+)/);
        const resolution = resParts ? `${resParts[1]}x${resParts[2]}` : undefined;

        displays.push({
          name,
          connected: true, // system_profiler only lists connected displays
          primary: isFirst,
          resolution,
        });
        isFirst = false;
      }
    }
  } catch { /* system_profiler not available */ }

  if (displays.length === 0) {
    // Fallback: at least report one display
    displays.push({ name: 'default', connected: true, primary: true });
  }
  return displays;
}

// ---------------------------------------------------------------------------
// Windows: PowerShell Get-CimInstance
// ---------------------------------------------------------------------------

async function detectWindows(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];
  try {
    const cmd = new Deno.Command('powershell', {
      args: ['-NoProfile', '-Command',
        'Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBasicDisplayParams | ForEach-Object { $id = $_.InstanceName; $connected = $_.Active; $name = (Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorID | Where-Object { $_.InstanceName -eq $id }).UserFriendlyName; Write-Output "$($name -join \\"\\")|||$connected" }',
      ],
      stdout: 'piped',
      stderr: 'piped',
    });
    const output = await cmd.output();
    if (!output.success) {
      // Fallback: simpler query
      return await detectWindowsFallback();
    }

    const text = new TextDecoder().decode(output.stdout).trim();
    let isFirst = true;
    for (const line of text.split('\n')) {
      const [name, active] = line.trim().split('|||');
      if (!name) continue;
      const connected = active?.trim() === 'True';
      displays.push({
        name: name.trim() || `Display ${displays.length + 1}`,
        connected,
        primary: isFirst && connected,
      });
      if (isFirst && connected) isFirst = false;
    }
  } catch { /* PowerShell not available */ }

  if (displays.length === 0) {
    return await detectWindowsFallback();
  }
  return displays;
}

async function detectWindowsFallback(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];
  try {
    // Simpler approach using Win32_DesktopMonitor
    const cmd = new Deno.Command('powershell', {
      args: ['-NoProfile', '-Command',
        'Get-CimInstance Win32_DesktopMonitor | Select-Object Name, ScreenWidth, ScreenHeight | ConvertTo-Json',
      ],
      stdout: 'piped',
      stderr: 'piped',
    });
    const output = await cmd.output();
    if (!output.success) {
      return [{ name: 'default', connected: true, primary: true }];
    }

    const data = JSON.parse(new TextDecoder().decode(output.stdout));
    const monitors = Array.isArray(data) ? data : [data];

    let isFirst = true;
    for (const monitor of monitors) {
      const w = monitor.ScreenWidth;
      const h = monitor.ScreenHeight;
      displays.push({
        name: monitor.Name || `Display ${displays.length + 1}`,
        connected: true,
        primary: isFirst,
        resolution: (w && h) ? `${w}x${h}` : undefined,
      });
      isFirst = false;
    }
  } catch { /* fallback failed */ }

  if (displays.length === 0) {
    displays.push({ name: 'default', connected: true, primary: true });
  }
  return displays;
}

// ---------------------------------------------------------------------------
// Display power control
// ---------------------------------------------------------------------------

export class DisplayController {
  private isOn = true;

  async on(): Promise<void> {
    if (this.isOn) return;
    this.isOn = true;

    try {
      switch (PLATFORM) {
        case 'linux':
          await run('xrandr', ['--output', await getPrimaryOutput(), '--auto']);
          break;
        case 'darwin':
          await run('caffeinate', ['-u', '-t', '1']);
          break;
        case 'windows':
          // Use PowerShell to wake display
          await run('powershell', ['-NoProfile', '-Command',
            '(Add-Type -MemberDefinition \'[DllImport("user32.dll")]public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);\' -Name a -Pas)::SendMessage(-1,0x0112,0xF170,-1)']);
          break;
      }
      console.log('[DISPLAY] Monitor ON');
    } catch (error) {
      console.warn('[DISPLAY] Failed to turn on:', error instanceof Error ? error.message : error);
    }
  }

  async off(): Promise<void> {
    if (!this.isOn) return;
    this.isOn = false;

    try {
      switch (PLATFORM) {
        case 'linux':
          await run('xrandr', ['--output', await getPrimaryOutput(), '--off']);
          break;
        case 'darwin':
          await run('pmset', ['displaysleepnow']);
          break;
        case 'windows':
          await run('powershell', ['-NoProfile', '-Command',
            '(Add-Type -MemberDefinition \'[DllImport("user32.dll")]public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);\' -Name a -Pas)::SendMessage(-1,0x0112,0xF170,2)']);
          break;
      }
      console.log('[DISPLAY] Monitor OFF');
    } catch (error) {
      console.warn('[DISPLAY] Failed to turn off:', error instanceof Error ? error.message : error);
    }
  }
}

async function getPrimaryOutput(): Promise<string> {
  try {
    const cmd = new Deno.Command('xrandr', { stdout: 'piped', stderr: 'null' });
    const output = await cmd.output();
    const text = new TextDecoder().decode(output.stdout);
    const match = text.match(/^(\S+)\s+connected\s+primary/m);
    if (match) return match[1];
    const fallback = text.match(/^(\S+)\s+connected/m);
    return fallback?.[1] || 'HDMI-1';
  } catch {
    return 'HDMI-1';
  }
}

async function run(cmd: string, args: string[]): Promise<void> {
  const command = new Deno.Command(cmd, { args, stdout: 'null', stderr: 'null' });
  await command.output();
}
