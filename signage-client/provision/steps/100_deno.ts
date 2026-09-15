import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'deno',
  name: 'Install Deno runtime',

  async do(_config: SavedConfig, ctx: ProvisionContext) {
    // Check if Deno is already installed
    const check = await ctx.ssh('deno --version 2>/dev/null');
    if (check.code === 0) {
      console.log(`  Deno already installed: ${check.stdout.split('\n')[0]}`);
      const upgrade = await ctx.confirm('  Upgrade Deno to latest?', false);
      if (upgrade) {
        console.log('  Upgrading Deno...');
        await ctx.ssh('deno upgrade');
      }
      return;
    }

    console.log('  Installing Deno...');
    const result = await ctx.ssh('curl -fsSL https://deno.land/install.sh | sh');
    if (result.code !== 0) {
      throw new Error('Failed to install Deno');
    }

    // Ensure deno is on PATH in .bashrc
    await ctx.ssh(
      `grep -q 'deno' ~/.bashrc || echo 'export DENO_DIR="\$HOME/.deno"' >> ~/.bashrc && echo 'export PATH="\$HOME/.deno/bin:\$PATH"' >> ~/.bashrc`,
    );

    console.log('  Deno installed successfully.');
  },
};

export default step;
