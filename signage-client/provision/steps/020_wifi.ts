import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'wifi',
  name: 'WiFi configuration',

  async ask(config: SavedConfig, ctx: ProvisionContext) {
    if (!ctx.piModel.hasWifi) {
      console.log('  No WiFi adapter detected — skipping WiFi setup.');
      config.wifiSetup = false;
      return;
    }

    if (config.wifiSetup === undefined) {
      config.wifiSetup = await ctx.confirm('Set up WiFi?', false);
    }
    if (config.wifiSetup) {
      if (!config.wifiSsid) {
        config.wifiSsid = await ctx.prompt('WiFi SSID (access point name)');
      }
      if (!config.wifiPassword) {
        config.wifiPassword = await ctx.promptSecret('WiFi password (leave empty for open network)');
      }
      if (config.wifiDeletePrevious === undefined) {
        config.wifiDeletePrevious = await ctx.confirm('Delete all previous WiFi connections?', false);
      }
    }
  },

  save(_config: SavedConfig) {
    // wifiSetup, wifiSsid, wifiPassword, wifiDeletePrevious are on config
  },

  async do(config: SavedConfig, ctx: ProvisionContext) {
    if (!config.wifiSetup || !ctx.piModel.hasWifi) {
      return;
    }

    const ssid = config.wifiSsid as string;
    const password = config.wifiPassword as string;

    console.log('  Enabling WiFi radio...');
    await ctx.sshSudo('nmcli radio wifi on');

    if (config.wifiDeletePrevious) {
      console.log('  Deleting previous WiFi connections...');
      await ctx.ssh(
        `for uuid in $(nmcli -t -f UUID,TYPE connection show | grep ':802-11-wireless$' | cut -d':' -f1); do sudo nmcli connection delete "$uuid"; done`,
      );
    }

    console.log(`  Connecting to ${ssid}...`);
    if (password) {
      await ctx.sshSudo(
        `nmcli con add type wifi con-name signage password "${password}" ifname wlan0 ssid "${ssid}"`,
      );
    } else {
      await ctx.sshSudo(
        `nmcli con add type wifi con-name signage ifname wlan0 ssid "${ssid}"`,
      );
    }
    await ctx.sshSudo('nmcli con modify signage connection.autoconnect yes');
    await ctx.sshSudo('nmcli con up signage');
  },
};

export default step;
