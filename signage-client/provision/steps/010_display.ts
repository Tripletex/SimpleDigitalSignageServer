import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'display',
  name: 'Install X11 and Chromium kiosk',

  async do(_config: SavedConfig, ctx: ProvisionContext) {
    const { piModel } = ctx;

    console.log('  Installing X11, OpenBox, and Chromium...');
    await ctx.sshSudo(
      'apt-get install --no-install-recommends -y ' +
      'xserver-xorg x11-xserver-utils xinit openbox ' +
      'chromium-browser unclutter',
    );

    // X11 output config
    console.log('  Configuring X11 output...');
    await ctx.sshSudo('mkdir -p /etc/X11/xorg.conf.d');
    await ctx.writeRemoteFileSudo('/etc/X11/xorg.conf.d/99-v3d.conf', `\
Section "OutputClass"
  Identifier "vc4"
  MatchDriver "vc4"
  Driver "modesetting"
  Option "PrimaryGPU" "true"
EndSection
`);

    // Build xrandr command based on available HDMI ports
    let xrandrCmd: string;
    if (piModel.hdmiPorts >= 2) {
      xrandrCmd = 'xrandr --output HDMI-1 --auto --primary --output HDMI-2 --auto --right-of HDMI-1';
    } else {
      xrandrCmd = 'xrandr --output HDMI-1 --auto --primary';
    }

    // OpenBox autostart — launches signage client
    console.log(`  Configuring OpenBox autostart (${piModel.hdmiPorts} HDMI port(s))...`);
    await ctx.ssh('mkdir -p ~/.config/openbox');
    await ctx.writeRemoteFile('/home/' + ctx.user + '/.config/openbox/autostart', `\
# Display setup
${xrandrCmd}
xset -dpms
xset s off
xset s noblank
unclutter -idle 0 &

# Start signage client (Deno)
cd $HOME/signage-client
deno task start > /tmp/signage-client.log 2>&1
`);

    // .xinitrc to launch OpenBox
    await ctx.writeRemoteFile('/home/' + ctx.user + '/.xinitrc', 'exec openbox-session\n');

    // Auto-start X on login
    console.log('  Configuring auto-start X on login...');
    await ctx.sshSudo('systemctl set-default multi-user.target');
    const bashProfile = '[[ -z $DISPLAY && $XDG_VTNR -eq 1 ]] && startx';
    await ctx.ssh(
      `grep -qxF '${bashProfile}' ~/.bash_profile 2>/dev/null || echo '${bashProfile}' >> ~/.bash_profile`,
    );
  },
};

export default step;
