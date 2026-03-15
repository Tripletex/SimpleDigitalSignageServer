import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'vpn',
  name: 'VPN configuration',

  async ask(config: SavedConfig, ctx: ProvisionContext) {
    if (config.vpnSetup === undefined) {
      config.vpnSetup = await ctx.confirm('Set up a VPN?', false);
    }
    if (config.vpnSetup) {
      if (!config.vpnType) {
        config.vpnType = await ctx.prompt('VPN type (openfortivpn)', 'openfortivpn');
      }
      if (config.vpnType === 'openfortivpn') {
        if (!config.vpnServer) {
          config.vpnServer = await ctx.prompt('FortiVPN server (host or host:port)');
        }
        if (!config.vpnUsername) {
          config.vpnUsername = await ctx.prompt('VPN username');
        }
        if (!config.vpnPassword) {
          config.vpnPassword = await ctx.promptSecret('VPN password');
        }
      }
    }
  },

  save(_config: SavedConfig) {
    // vpnSetup, vpnType, vpnServer, vpnUsername, vpnPassword are on config
  },

  async do(config: SavedConfig, ctx: ProvisionContext) {
    if (!config.vpnSetup || config.vpnType !== 'openfortivpn') {
      console.log('  Skipping VPN setup.');
      return;
    }

    const server = config.vpnServer as string;
    const username = config.vpnUsername as string;
    const password = config.vpnPassword as string;
    const port = server.includes(':') ? server.split(':')[1] : '443';
    const host = server.includes(':') ? server.split(':')[0] : server;

    console.log('  Installing openfortivpn...');
    await ctx.sshSudo('apt-get install -y openfortivpn');

    console.log('  Writing VPN configuration...');
    await ctx.writeRemoteFileSudo('/etc/openfortivpn/config', `\
host = ${host}
port = ${port}
username = ${username}
password = ${password}
set-dns = 1
pppd-use-peerdns = 1
set-routes = 1
pppd-log = /var/log/pppd.log
`);

    // Startup script that fetches the SSL fingerprint dynamically
    await ctx.writeRemoteFileSudo('/etc/openfortivpn/startvpn.sh', `\
#!/bin/bash
CERT_FINGERPRINT=$(openssl s_client -connect ${host}:${port} </dev/null 2>/dev/null | openssl x509 -fingerprint -sha256 -noout | sed 's/sha256 Fingerprint=//' | tr -d ':' | tr '[:upper:]' '[:lower:]')
echo "Found sha256 vpn fingerprint: $CERT_FINGERPRINT"
openfortivpn -c /etc/openfortivpn/config --trusted-cert=$CERT_FINGERPRINT
`);
    await ctx.sshSudo('chmod +x /etc/openfortivpn/startvpn.sh');

    // Systemd service
    console.log('  Creating systemd service...');
    await ctx.writeRemoteFileSudo('/etc/systemd/system/openfortivpn.service', `\
[Unit]
Description=OpenFortiVPN
After=network-online.target
Wants=network-online.target

[Service]
ExecStartPre=/bin/sleep 10
Type=simple
ExecStart=/bin/bash /etc/openfortivpn/startvpn.sh
User=root
WorkingDirectory=/etc/openfortivpn
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
`);

    await ctx.sshSudo('systemctl daemon-reload');
    await ctx.sshSudo('systemctl enable openfortivpn.service');
    await ctx.sshSudo('systemctl start openfortivpn.service');
    console.log('  VPN service started.');
  },
};

export default step;
