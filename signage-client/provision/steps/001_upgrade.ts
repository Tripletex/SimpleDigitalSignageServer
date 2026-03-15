import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'upgrade',
  name: 'Update Raspberry Pi OS',

  async ask(config: SavedConfig, ctx: ProvisionContext) {
    config.doUpgrade = await ctx.confirm('Update and upgrade Raspberry Pi OS?', true);
  },

  save(_config: SavedConfig) {
    // doUpgrade is already on the config
  },

  async do(config: SavedConfig, ctx: ProvisionContext) {
    if (!config.doUpgrade) {
      console.log('  Skipping OS upgrade.');
      return;
    }
    console.log('  Updating package lists...');
    await ctx.sshSudo('apt-get update');
    console.log('  Upgrading packages (this may take a while)...');
    await ctx.sshSudo('DEBIAN_FRONTEND=noninteractive apt-get upgrade -y');
  },
};

export default step;
