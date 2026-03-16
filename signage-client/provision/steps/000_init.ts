import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'init',
  name: 'Initialize Pi configuration',

  async do(_config: SavedConfig, ctx: ProvisionContext) {
    const { piModel } = ctx;

    console.log('  Creating config directories...');
    await ctx.ssh('mkdir -p ~/.config/signage-client');

    console.log('  Enabling auto-login...');
    await ctx.sshSudo('raspi-config nonint do_boot_behaviour B2');

    // Boot config path differs by model
    const bootConfig = piModel.bootConfig;
    console.log(`  Configuring boot (${bootConfig})...`);
    await ctx.sshSudo(
      `if [ ! -f ${bootConfig}.bak ]; then cp ${bootConfig} ${bootConfig}.bak; fi`,
    );

    if (piModel.useFkms) {
      // Pi 3: switch to fake KMS for compatibility
      console.log('  Setting fake KMS overlay (Pi 3)...');
      await ctx.sshSudo(
        `sed -i 's|^dtoverlay=vc4-kms-v3d|dtoverlay=vc4-fkms-v3d|g' ${bootConfig}`,
      );
    } else {
      // Pi 4/5: ensure full KMS is active
      console.log('  Ensuring full KMS overlay (Pi 4/5)...');
      await ctx.sshSudo(
        `sed -i 's|^dtoverlay=vc4-fkms-v3d|dtoverlay=vc4-kms-v3d|g' ${bootConfig}`,
      );
    }
  },
};

export default step;
