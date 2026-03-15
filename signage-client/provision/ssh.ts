import type { ProvisionContext } from './types.ts';

/**
 * Create an SSH-based provision context for executing commands on a remote Pi.
 */
export function createContext(
  host: string,
  user: string,
  keyFile: string,
): ProvisionContext {
  const sshArgs = [
    '-i', keyFile,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=10',
    `${user}@${host}`,
  ];

  const context: ProvisionContext = {
    host,
    user,
    keyFile,

    async ssh(command: string) {
      const proc = new Deno.Command('ssh', {
        args: [...sshArgs, command],
        stdout: 'piped',
        stderr: 'piped',
      });
      const result = await proc.output();
      const stdout = new TextDecoder().decode(result.stdout);
      const stderr = new TextDecoder().decode(result.stderr);
      if (!result.success) {
        console.error(`  SSH command failed: ${command}`);
        if (stderr.trim()) console.error(`  stderr: ${stderr.trim()}`);
      }
      return { code: result.code, stdout, stderr };
    },

    async sshSudo(command: string) {
      return context.ssh(`sudo ${command}`);
    },

    async scp(localPath: string, remotePath: string) {
      const proc = new Deno.Command('scp', {
        args: [
          '-i', keyFile,
          '-o', 'StrictHostKeyChecking=accept-new',
          '-r',
          localPath,
          `${user}@${host}:${remotePath}`,
        ],
        stdout: 'piped',
        stderr: 'piped',
      });
      const result = await proc.output();
      if (!result.success) {
        const stderr = new TextDecoder().decode(result.stderr);
        throw new Error(`scp failed: ${stderr}`);
      }
    },

    async writeRemoteFile(remotePath: string, content: string) {
      // Write to a temp file locally, scp it, then move it
      const tmpLocal = await Deno.makeTempFile();
      await Deno.writeTextFile(tmpLocal, content);
      await context.scp(tmpLocal, remotePath);
      await Deno.remove(tmpLocal);
    },

    async writeRemoteFileSudo(remotePath: string, content: string) {
      const tmpRemote = `/tmp/provision_${crypto.randomUUID().slice(0, 8)}`;
      await context.writeRemoteFile(tmpRemote, content);
      await context.sshSudo(`mv ${tmpRemote} ${remotePath}`);
    },

    async prompt(message: string, defaultValue?: string) {
      const suffix = defaultValue ? ` [${defaultValue}]` : '';
      const input = globalThis.prompt(`${message}${suffix}:`);
      return input?.trim() || defaultValue || '';
    },

    async confirm(message: string, defaultValue = false) {
      const suffix = defaultValue ? '[Y/n]' : '[y/N]';
      const input = globalThis.prompt(`${message} ${suffix}:`);
      if (!input?.trim()) return defaultValue;
      return ['y', 'yes', 'true', '1'].includes(input.trim().toLowerCase());
    },

    async promptSecret(message: string) {
      // Deno doesn't have hidden input natively, use a subprocess
      const proc = new Deno.Command('bash', {
        args: ['-c', `read -s -p "${message}: " val && echo "$val"`],
        stdin: 'inherit',
        stdout: 'piped',
        stderr: 'inherit',
      });
      const result = await proc.output();
      console.log(); // newline after hidden input
      return new TextDecoder().decode(result.stdout).trim();
    },
  };

  return context;
}

/**
 * Generate an SSH key pair if it doesn't exist.
 */
export async function ensureKeyPair(keyFile: string): Promise<void> {
  try {
    await Deno.stat(keyFile);
    console.log(`Using existing SSH key: ${keyFile}`);
  } catch {
    console.log(`Generating SSH key pair: ${keyFile}`);
    const proc = new Deno.Command('ssh-keygen', {
      args: ['-t', 'ed25519', '-f', keyFile, '-N', ''],
      stdout: 'piped',
      stderr: 'piped',
    });
    const result = await proc.output();
    if (!result.success) {
      throw new Error('Failed to generate SSH key pair');
    }
  }
}

/**
 * Copy the public key to the remote host for passwordless SSH.
 */
export async function copyPublicKey(
  host: string,
  user: string,
  keyFile: string,
): Promise<void> {
  console.log(`Copying SSH public key to ${user}@${host}...`);
  const proc = new Deno.Command('ssh-copy-id', {
    args: [
      '-i', `${keyFile}.pub`,
      '-o', 'StrictHostKeyChecking=accept-new',
      `${user}@${host}`,
    ],
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const result = await proc.output();
  if (!result.success) {
    throw new Error('Failed to copy SSH public key. Make sure the Pi is reachable and the password is correct.');
  }
}
