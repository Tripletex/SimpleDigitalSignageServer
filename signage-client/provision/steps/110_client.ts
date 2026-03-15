import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';
import { resolve, dirname, fromFileUrl } from 'jsr:@std/path';

const step: ProvisionStep = {
  id: 'client',
  name: 'Deploy signage client',

  async ask(config: SavedConfig, ctx: ProvisionContext) {
    if (!config.serverUrl) {
      config.serverUrl = await ctx.prompt('Server URL', 'http://localhost:4000');
    }
  },

  save(_config: SavedConfig) {
    // serverUrl is on config
  },

  async do(config: SavedConfig, ctx: ProvisionContext) {
    // Resolve signage-client source directory (relative to this script)
    const scriptDir = dirname(fromFileUrl(import.meta.url));
    const clientDir = resolve(scriptDir, '..', '..');

    console.log('  Copying signage-client to Pi...');
    // Clean remote directory first, then copy source
    await ctx.ssh('rm -rf ~/signage-client/src ~/signage-client/deno.json');
    await ctx.scp(`${clientDir}/src`, 'signage-client/src');
    await ctx.scp(`${clientDir}/deno.json`, 'signage-client/deno.json');

    // Cache dependencies on the Pi
    console.log('  Caching Deno dependencies...');
    await ctx.ssh('cd ~/signage-client && ~/.deno/bin/deno cache src/main.ts');

    // Write client config
    console.log('  Writing client configuration...');
    const serverUrl = config.serverUrl as string;
    await ctx.ssh('mkdir -p ~/.config/signage-client');
    await ctx.writeRemoteFile(
      `/home/${ctx.user}/.config/signage-client/config.json`,
      JSON.stringify({ serverUrl }, null, 2) + '\n',
    );

    // Create systemd service for the signage client
    console.log('  Creating systemd service...');
    await ctx.writeRemoteFileSudo('/etc/systemd/system/signage-client.service', `\
[Unit]
Description=Digital Signage Client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${ctx.user}
WorkingDirectory=/home/${ctx.user}/signage-client
Environment=HOME=/home/${ctx.user}
Environment=PATH=/home/${ctx.user}/.deno/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/home/${ctx.user}/.deno/bin/deno task start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
`);

    await ctx.sshSudo('systemctl daemon-reload');
    await ctx.sshSudo('systemctl enable signage-client.service');
    console.log('  Signage client deployed and enabled.');
  },
};

export default step;
