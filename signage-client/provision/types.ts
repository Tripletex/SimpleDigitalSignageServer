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

/** Detected Raspberry Pi model info */
export interface PiModel {
  /** Raw model string from /proc/device-tree/model, e.g. "Raspberry Pi 5 Model B Rev 1.0" */
  raw: string;
  /** Major Pi generation: 3, 4, 5, etc. */
  generation: number;
  /** Number of HDMI ports (1 for Pi 3, 2 for Pi 4/5) */
  hdmiPorts: number;
  /** Boot config file location */
  bootConfig: string;
  /** Whether this Pi supports full KMS (Pi 4/5) or needs fake KMS (Pi 3) */
  useFkms: boolean;
  /** Whether the Pi has a WiFi adapter */
  hasWifi: boolean;
}

export interface ProvisionContext {
  host: string;
  user: string;
  keyFile: string;
  /** Detected Pi model — set after SSH connection is established */
  piModel: PiModel;
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
