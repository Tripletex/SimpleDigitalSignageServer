import type { ProvisionStep, SavedConfig, ProvisionContext } from '../types.ts';

const step: ProvisionStep = {
  id: 'display',
  name: 'Install X11 and Chromium kiosk',

  async do(_config: SavedConfig, ctx: ProvisionContext) {
    console.log('  Installing X11, OpenBox, and Chromium...');
    await ctx.sshSudo(
      'apt-get install --no-install-recommends -y ' +
      'xserver-xorg x11-xserver-utils xinit openbox ' +
      'chromium-browser unclutter',
    );

    // X11 output config for dual HDMI
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

    // OpenBox autostart — launches Chromium in kiosk mode via the signage-client
    console.log('  Configuring OpenBox autostart...');
    await ctx.ssh('mkdir -p ~/.config/openbox');
    await ctx.writeRemoteFile('/home/' + ctx.user + '/.config/openbox/autostart', `\
# Display setup
xrandr --output HDMI-1 --auto --primary --output HDMI-2 --auto --right-of HDMI-1
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
