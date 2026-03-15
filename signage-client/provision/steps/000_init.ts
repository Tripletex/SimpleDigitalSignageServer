import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'init',
  name: 'Initialize Pi configuration',

  async do(_config: SavedConfig, ctx: ProvisionContext) {
    console.log('  Creating config directories...');
    await ctx.ssh('mkdir -p ~/.config/signage-client');

    console.log('  Enabling auto-login...');
    await ctx.sshSudo('raspi-config nonint do_boot_behaviour B2');

    // Fix dual monitor support (vc4-kms-v3d → vc4-fkms-v3d)
    console.log('  Configuring boot for dual HDMI...');
    await ctx.sshSudo(
      'if [ ! -f /boot/config.txt.bak ]; then cp /boot/config.txt /boot/config.txt.bak; fi',
    );
    await ctx.sshSudo(
      `sed -i 's|^dtoverlay=vc4-kms-v3d|dtoverlay=vc4-fkms-v3d|g' /boot/config.txt`,
    );
  },
};

export default step;
