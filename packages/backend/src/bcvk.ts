/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import * as extensionApi from '@podman-desktop/api';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Octokit } from '@octokit/rest';
import {
  BCVK_GITHUB_OWNER,
  BCVK_GITHUB_REPO,
  BCVK_BINARY_NAME,
  BCVK_SUPPORTED_PLATFORMS,
} from './constants';

export interface BcvkBinaryInfo {
  path: string;
  version: string;
  installationSource: 'extension' | 'external';
}

export interface BcvkReleaseAsset {
  id: number;
  name: string;
  tag: string;
}

// bcvk stores generated SSH keys inside a bwrap namespace
// From the container's perspective (via podman exec), the key is at /run/tmproot/var/lib/bcvk/ssh
// Users can SSH from the container terminal with:
// ssh -i /run/tmproot/var/lib/bcvk/ssh root@127.0.0.1 -p 2222
export const BCVK_SSH_KEY_PATH = '/run/tmproot/var/lib/bcvk/ssh';
export const BCVK_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i /run/tmproot/var/lib/bcvk/ssh root@127.0.0.1 -p 2222';

export class BcvkDownload {
  private octokit: Octokit;
  private storagePath: string;

  constructor(
    private readonly extensionContext: extensionApi.ExtensionContext,
    octokit?: Octokit,
  ) {
    this.octokit = octokit ?? new Octokit();
    this.storagePath = extensionContext.storagePath;
  }

  // Get the path where bcvk binary would be stored by the extension
  getBcvkExtensionPath(): string {
    return path.join(this.storagePath, BCVK_BINARY_NAME);
  }

  // Check if bcvk is available in system PATH
  async findBcvkInPath(): Promise<string | undefined> {
    const env = process.env;
    if (extensionApi.env.isWindows) {
      // bcvk doesn't support Windows currently
      return undefined;
    }

    const pathDirs = (env.PATH ?? '').split(path.delimiter);
    for (const dir of pathDirs) {
      const fullPath = path.join(dir, BCVK_BINARY_NAME);
      try {
        await fs.promises.access(fullPath, fs.constants.X_OK);
        return fullPath;
      } catch {
        // Continue searching
      }
    }
    return undefined;
  }

  // Find bcvk binary - checks PATH first, then extension storage
  async findBcvk(): Promise<string | undefined> {
    // First check system PATH
    const systemPath = await this.findBcvkInPath();
    if (systemPath) {
      return systemPath;
    }

    // Then check extension storage
    const extensionPath = this.getBcvkExtensionPath();
    try {
      await fs.promises.access(extensionPath, fs.constants.X_OK);
      return extensionPath;
    } catch {
      return undefined;
    }
  }

  // Get bcvk version from binary
  async getBcvkVersion(bcvkPath: string): Promise<string> {
    try {
      const { stdout } = await extensionApi.process.exec(bcvkPath, ['--version']);
      // Parse version from output like "bcvk 0.9.0"
      const match = stdout.match(/bcvk\s+(\d+\.\d+\.\d+)/);
      return match ? match[1] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // Check if current platform is supported
  isSupportedPlatform(): boolean {
    const platform = os.platform();
    const arch = os.arch();
    const platformKey = `${platform}-${arch}`;
    return platformKey in BCVK_SUPPORTED_PLATFORMS;
  }

  // Get the asset name for the current platform
  getAssetNameForPlatform(): string | undefined {
    const platform = os.platform();
    const arch = os.arch();
    const platformKey = `${platform}-${arch}`;
    return BCVK_SUPPORTED_PLATFORMS[platformKey];
  }

  // Get latest release metadata from GitHub
  async getLatestRelease(): Promise<{ tag: string; id: number } | undefined> {
    try {
      const release = await this.octokit.repos.getLatestRelease({
        owner: BCVK_GITHUB_OWNER,
        repo: BCVK_GITHUB_REPO,
      });
      return {
        tag: release.data.tag_name,
        id: release.data.id,
      };
    } catch (error) {
      console.error('Failed to get latest bcvk release:', error);
      return undefined;
    }
  }

  // Get release asset ID for the current platform
  async getReleaseAssetId(releaseId: number): Promise<number | undefined> {
    const assetName = this.getAssetNameForPlatform();
    if (!assetName) {
      return undefined;
    }

    try {
      const assets = await this.octokit.repos.listReleaseAssets({
        owner: BCVK_GITHUB_OWNER,
        repo: BCVK_GITHUB_REPO,
        release_id: releaseId,
      });

      const asset = assets.data.find(a => a.name === assetName);
      return asset?.id;
    } catch (error) {
      console.error('Failed to get release assets:', error);
      return undefined;
    }
  }

  // Download and extract bcvk binary
  async download(): Promise<string> {
    if (!this.isSupportedPlatform()) {
      throw new Error(`bcvk is not supported on ${os.platform()}-${os.arch()}. Currently only Linux x86_64 is supported.`);
    }

    const latestRelease = await this.getLatestRelease();
    if (!latestRelease) {
      throw new Error('Failed to get latest bcvk release from GitHub');
    }

    const assetId = await this.getReleaseAssetId(latestRelease.id);
    if (!assetId) {
      throw new Error('Failed to find bcvk binary for current platform');
    }

    // Ensure storage directory exists
    await fs.promises.mkdir(this.storagePath, { recursive: true });

    // Download the asset
    const assetResponse = await this.octokit.repos.getReleaseAsset({
      owner: BCVK_GITHUB_OWNER,
      repo: BCVK_GITHUB_REPO,
      asset_id: assetId,
      headers: {
        Accept: 'application/octet-stream',
      },
    });

    // The asset is a tar.gz file, we need to extract it
    const tarPath = path.join(this.storagePath, 'bcvk.tar.gz');
    const data = assetResponse.data as unknown as ArrayBuffer;
    await fs.promises.writeFile(tarPath, Buffer.from(data));

    // Extract using tar command
    const bcvkPath = this.getBcvkExtensionPath();
    await extensionApi.process.exec('tar', ['-xzf', tarPath, '-C', this.storagePath]);

    // Look for the bcvk binary - it might have different names depending on the release
    // Try common patterns: 'bcvk', 'bcvk-x86_64-unknown-linux-gnu', etc.
    const possibleNames = [
      'bcvk',
      'bcvk-x86_64-unknown-linux-gnu',
      'bcvk-aarch64-unknown-linux-gnu',
      'bcvk-aarch64-apple-darwin',
      'bcvk-x86_64-apple-darwin',
    ];

    let foundBinary: string | undefined;
    for (const name of possibleNames) {
      const candidatePath = path.join(this.storagePath, name);
      if (fs.existsSync(candidatePath)) {
        foundBinary = candidatePath;
        break;
      }
    }

    if (!foundBinary) {
      // List directory contents to help debug
      const files = await fs.promises.readdir(this.storagePath);
      throw new Error(`Could not find bcvk binary after extraction. Found files: ${files.join(', ')}`);
    }

    // Rename to standard name if needed
    if (foundBinary !== bcvkPath) {
      await fs.promises.rename(foundBinary, bcvkPath);
    }

    // Make executable
    await fs.promises.chmod(bcvkPath, 0o755);

    // Clean up tar file
    await fs.promises.unlink(tarPath);

    return bcvkPath;
  }

  // Install bcvk with progress indication
  async install(): Promise<string> {
    return extensionApi.window.withProgress(
      {
        location: extensionApi.ProgressLocation.TASK_WIDGET,
        title: 'Installing bcvk',
      },
      async progress => {
        progress.report({ increment: 10 });
        const bcvkPath = await this.download();
        progress.report({ increment: 100 });
        return bcvkPath;
      },
    );
  }

  // Uninstall bcvk from extension storage
  async uninstall(): Promise<void> {
    const extensionPath = this.getBcvkExtensionPath();
    try {
      await fs.promises.unlink(extensionPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

// Singleton handler for bcvk operations
export class BcvkHandler {
  private bcvkPath: string | undefined;
  private bcvkDownload: BcvkDownload;

  constructor(
    private readonly extensionContext: extensionApi.ExtensionContext,
    private readonly telemetryLogger: extensionApi.TelemetryLogger,
  ) {
    this.bcvkDownload = new BcvkDownload(extensionContext);
  }

  // Initialize and find bcvk
  async init(): Promise<void> {
    this.bcvkPath = await this.bcvkDownload.findBcvk();
  }

  // Check if bcvk is available
  isAvailable(): boolean {
    return !!this.bcvkPath;
  }

  // Get bcvk binary info
  async getBinaryInfo(): Promise<BcvkBinaryInfo | undefined> {
    if (!this.bcvkPath) {
      return undefined;
    }

    const version = await this.bcvkDownload.getBcvkVersion(this.bcvkPath);
    const extensionPath = this.bcvkDownload.getBcvkExtensionPath();
    const installationSource = this.bcvkPath === extensionPath ? 'extension' : 'external';

    return {
      path: this.bcvkPath,
      version,
      installationSource,
    };
  }

  // Check if platform is supported
  isSupportedPlatform(): boolean {
    return this.bcvkDownload.isSupportedPlatform();
  }

  // Install bcvk
  async install(): Promise<void> {
    this.bcvkPath = await this.bcvkDownload.install();
  }

  // Uninstall bcvk
  async uninstall(): Promise<void> {
    await this.bcvkDownload.uninstall();
    this.bcvkPath = undefined;
  }

  // Run ephemeral VM with SSH access enabled
  // Uses -K to generate SSH keys and --network host so we can SSH from the host
  async runEphemeralVM(image: string): Promise<string> {
    if (!this.bcvkPath) {
      throw new Error('bcvk is not installed');
    }

    const telemetryData: Record<string, unknown> = {};
    const startTime = performance.now();

    // Generate a unique container name
    const imageName = image.split('/').pop()?.split(':')[0] ?? 'bootc';
    const containerName = `bcvk-ephemeral-${imageName}-${Date.now()}`;

    try {
      // Run bcvk ephemeral in detached mode with SSH key generation
      // -d: detached mode (run in background)
      // -K: generate SSH keypair and inject into VM
      // --rm: remove container when stopped
      // --name: specify container name so we can find it
      // --network host: share host network so QEMU's port 2222 is accessible from host
      await extensionApi.process.exec(this.bcvkPath, [
        'ephemeral',
        'run',
        '-d',
        '-K',
        '--rm',
        '--name',
        containerName,
        '--network',
        'host',
        image,
      ]);

      telemetryData.success = true;
      telemetryData.containerName = containerName;

      return containerName;
    } catch (error) {
      telemetryData.error = String(error);
      throw error;
    } finally {
      const endTime = performance.now();
      telemetryData.duration = endTime - startTime;
      this.telemetryLogger.logUsage('bcvk.ephemeral.run', telemetryData);
    }
  }

  // Extract the SSH private key from the container
  async extractSshKey(containerName: string): Promise<string> {
    // Wait for the key to be generated (VM needs to start first)
    const maxRetries = 30;
    const delayMs = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const { stdout } = await extensionApi.process.exec('podman', [
          'exec',
          containerName,
          'cat',
          BCVK_SSH_KEY_PATH,
        ]);

        if (stdout && stdout.includes('PRIVATE KEY')) {
          return stdout;
        }
      } catch {
        // Key not ready yet, wait and retry
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error(`SSH key not found in container ${containerName} after ${maxRetries} attempts`);
  }

  // Setup auto-SSH in the container so terminal opens directly into VM
  async setupAutoSsh(containerName: string): Promise<void> {
    // This script is added to .bashrc and will:
    // 1. Wait for the SSH key to be available
    // 2. Wait for the VM to be ready
    // 3. Automatically SSH into the VM
    const autoSshScript = `
# bcvk auto-SSH setup
if [ -z "$BCVK_AUTO_SSH_DONE" ]; then
  export BCVK_AUTO_SSH_DONE=1

  SSH_KEY="${BCVK_SSH_KEY_PATH}"
  SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5"

  echo ""
  echo "  ___________"
  echo " /          /|"
  echo "|   (ᵔᴥᵔ)  | |"
  echo "|   bootc  | |"
  echo "|__________|/"
  echo ""
  echo "=== bcvk Ephemeral VM ==="
  echo "Waiting for VM to be ready..."
  echo ""

  # Wait for SSH key to exist
  while [ ! -f "$SSH_KEY" ]; do
    sleep 1
  done

  # Wait for VM to accept SSH connections
  while ! ssh $SSH_OPTS -o BatchMode=yes -i "$SSH_KEY" root@127.0.0.1 -p 2222 exit 2>/dev/null; do
    echo "VM not ready yet, retrying..."
    sleep 2
  done

  echo "Connecting to VM..."
  exec ssh $SSH_OPTS -i "$SSH_KEY" root@127.0.0.1 -p 2222
fi
`;

    try {
      await extensionApi.process.exec('podman', [
        'exec',
        containerName,
        'bash',
        '-c',
        `cat >> /root/.bashrc << 'BCVK_AUTO_SSH'
${autoSshScript}
BCVK_AUTO_SSH`,
      ]);
    } catch (err) {
      console.warn('Failed to setup auto-SSH in container:', err);
      // Non-fatal - user can still run the SSH command manually
    }
  }

  // Get the bcvk download instance for CLI tool registration
  getBcvkDownload(): BcvkDownload {
    return this.bcvkDownload;
  }

  // Get bcvk path
  getBcvkPath(): string | undefined {
    return this.bcvkPath;
  }

  // Set bcvk path (used after installation)
  setBcvkPath(path: string): void {
    this.bcvkPath = path;
  }
}
