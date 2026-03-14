export class DisplayController {
  private isOn = true;
  private platform: string;

  constructor() {
    this.platform = Deno.build.os;
  }

  async on(): Promise<void> {
    if (this.isOn) return;
    this.isOn = true;

    try {
      if (this.platform === 'linux') {
        await this.run('xrandr', ['--output', await this.getPrimaryOutput(), '--auto']);
      } else if (this.platform === 'darwin') {
        await this.run('caffeinate', ['-u', '-t', '1']);
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
      if (this.platform === 'linux') {
        await this.run('xrandr', ['--output', await this.getPrimaryOutput(), '--off']);
      } else if (this.platform === 'darwin') {
        await this.run('pmset', ['displaysleepnow']);
      }
      console.log('[DISPLAY] Monitor OFF');
    } catch (error) {
      console.warn('[DISPLAY] Failed to turn off:', error instanceof Error ? error.message : error);
    }
  }

  private async getPrimaryOutput(): Promise<string> {
    try {
      const cmd = new Deno.Command('xrandr', { stdout: 'piped', stderr: 'null' });
      const output = await cmd.output();
      const text = new TextDecoder().decode(output.stdout);
      const match = text.match(/^(\S+)\s+connected\s+primary/m);
      if (match) return match[1];
      // Fallback: first connected output
      const fallback = text.match(/^(\S+)\s+connected/m);
      return fallback?.[1] || 'HDMI-1';
    } catch {
      return 'HDMI-1';
    }
  }

  private async run(cmd: string, args: string[]): Promise<void> {
    const command = new Deno.Command(cmd, { args, stdout: 'null', stderr: 'null' });
    await command.output();
  }
}
