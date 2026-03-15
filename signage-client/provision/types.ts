/**
 * Provisioning step interface.
 * Each step can optionally ask for user input, save config, and execute commands.
 */
export interface ProvisionStep {
  /** Unique identifier for this step */
  id: string;
  /** Human-readable name */
  name: string;
  /** Ask the user for configuration (interactive prompts) */
  ask?(config: SavedConfig, context: ProvisionContext): Promise<void>;
  /** Save answers to the config object */
  save?(config: SavedConfig): void;
  /** Execute the step on the remote host */
  do?(config: SavedConfig, context: ProvisionContext): Promise<void>;
}

export interface ProvisionContext {
  host: string;
  user: string;
  keyFile: string;
  /** Run a command on the remote host via SSH */
  ssh(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  /** Run a command on the remote host via SSH with sudo */
  sshSudo(command: string): Promise<{ code: number; stdout: string; stderr: string }>;
  /** Copy a local file/directory to the remote host */
  scp(localPath: string, remotePath: string): Promise<void>;
  /** Write content to a remote file */
  writeRemoteFile(remotePath: string, content: string): Promise<void>;
  /** Write content to a remote file with sudo */
  writeRemoteFileSudo(remotePath: string, content: string): Promise<void>;
  /** Prompt user for input */
  prompt(message: string, defaultValue?: string): Promise<string>;
  /** Prompt user for yes/no */
  confirm(message: string, defaultValue?: boolean): Promise<boolean>;
  /** Prompt user for a password (hidden input) */
  promptSecret(message: string): Promise<string>;
}

export interface SavedConfig {
  [key: string]: unknown;
}

export interface ProvisionOptions {
  host: string;
  user: string;
  keyFile: string;
  serverUrl?: string;
  configFile: string;
}
