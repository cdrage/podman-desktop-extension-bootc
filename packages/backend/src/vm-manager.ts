/**********************************************************************
 * Copyright (C) 2024 Red Hat, Inc.
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

import path from 'node:path';
import * as extensionApi from '@podman-desktop/api';
import { isArm, isLinux, isMac, isWindows } from './machine-utils';
import fs from 'node:fs';
import type { BootcBuildInfo } from '/@shared/src/models/bootc';

// Singular pid file location (can only run 1 VM at a time)
// eslint-disable-next-line sonarjs/publicly-writable-directories
const unixPidLocation = '/tmp/qemu-podman-desktop.pid';

// Use ProgramData location for qemu pid file on Windows
const windowsPidLocation = 'C:\\ProgramData\\qemu-podman-desktop.pid';

// MacOS related
const macQemuArm64Binary = '/opt/homebrew/bin/qemu-system-aarch64';
const macQemuArm64Edk2 = '/opt/homebrew/share/qemu/edk2-aarch64-code.fd';
const macQemuX86Binary = '/opt/homebrew/bin/qemu-system-x86_64';
// Linux related
// Context: on linux, since we are in a flatpak environment, we let podman desktop handle where the qemu
// binary is, so we just need to call qemu-system-aarch64 instead of the full path
// this is not an issue with the mac version since we are not in a containerized environment and we explicitly need the brew version.
const linuxQemuArm64Binary = 'qemu-system-aarch64';
const linuxQemuX86Binary = 'qemu-system-x86_64';

// Windows related
// Make sure we use the ".exe" for qemu
// We use the "default" location of the install as to follow the installation guide for QEMU.
const windowsQemuX86Binary = 'C:\\Program Files\\qemu\\qemu-system-x86_64.exe';
const windowsQemuArm64Binary = 'C:\\Program Files\\qemu\\qemu-system-aarch64.exe';

// Default values for VM's
const hostForwarding = 'hostfwd=tcp::2222-:22';
const memorySize = '4G';
const websocketPort = '45252';
const rawImageLocation = 'image/disk.raw';

// Abstract base class
export abstract class VMManagerBase {
  protected build: BootcBuildInfo;
  protected pidFile: string;

  constructor(build: BootcBuildInfo) {
    this.build = build;
    this.pidFile = this.getPidFilePath();
  }

  private getPidFilePath(): string {
    if (isWindows()) {
      return windowsPidLocation;
    }
    // Default for macOS and Linux
    return unixPidLocation;
  }

  public abstract checkVMLaunchPrereqs(): Promise<string | undefined>;

  protected abstract generateLaunchCommand(diskImage: string): string[];

  public async launchVM(): Promise<void> {
    const diskImage = this.getDiskImagePath();

    if (!fs.existsSync(diskImage)) {
      throw new Error(`Raw disk image not found: ${diskImage}`);
    }

    try {
      const command = this.generateLaunchCommand(diskImage);

      if (command.length === 0) {
        throw new Error(
          'Unable to generate the launch command for the VM, ensure you are on the appropriate OS and architecture.',
        );
      }

      console.log(`(EXPERIMENTAL MODE) Launching VM with command: ${command.join(' ')}`);

      // If on Linux or Mac, we need to use the shell to execute the command
      if (isLinux() || isMac()) {
        await extensionApi.process.exec('sh', ['-c', `${command.join(' ')}`]);
      } else if (isWindows()) {
        await extensionApi.process.exec('cmd.exe', ['/C', `"${command.join(' ')}"`]);
      } else {
        throw new Error('Unsupported OS for running CLI');
      }
    } catch (e) {
      handleStdError(e);
    }
  }

  protected getDiskImagePath(): string {
    return path.join(this.build.folder, rawImageLocation);
  }
}

// Mac ARM VM Manager
class MacArmNativeVMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'arm64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via our installation document';
    if (!fs.existsSync(macQemuArm64Binary)) {
      return `QEMU arm64 binary not found at ${macQemuArm64Binary}. ${installDisclaimer}`;
    }
    if (!fs.existsSync(macQemuArm64Edk2)) {
      return `QEMU arm64 edk2-aarch64-code.fd file not found at ${macQemuArm64Edk2}. ${installDisclaimer}`;
    }
    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      macQemuArm64Binary,
      '-m',
      memorySize,
      '-nographic',
      '-M',
      'virt',
      '-accel',
      'hvf',
      '-cpu',
      'host',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'virtio-net,netdev=usernet',
      '-drive',
      `file=${macQemuArm64Edk2},format=raw,if=pflash,readonly=on`,
      '-snapshot',
      diskImage,
    ];
  }
}

// Mac ARM running x86 images VM Manager
class MacArmX86VMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'amd64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via our installation document';
    if (!fs.existsSync(macQemuX86Binary)) {
      return `QEMU x86 binary not found at ${macQemuX86Binary}. ${installDisclaimer}`;
    }
    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      macQemuX86Binary,
      '-m',
      memorySize,
      '-nographic',
      '-cpu',
      'qemu64',
      '-machine',
      'q35',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'e1000,netdev=usernet',
      '-snapshot',
      diskImage,
    ];
  }
}

class LinuxArmVMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'arm64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via your package manager.';
    try {
      await extensionApi.process.exec(linuxQemuArm64Binary, ['--version']);
    } catch {
      return `Unable to run "${linuxQemuArm64Binary} --version". ${installDisclaimer}`;
    }
    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      linuxQemuArm64Binary,
      '-m',
      memorySize,
      '-nographic',
      '-M',
      'virt',
      '-cpu',
      'max',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'virtio-net,netdev=usernet',
      '-snapshot',
      diskImage,
    ];
  }
}

class LinuxX86VMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'amd64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via your package manager.';
    try {
      await extensionApi.process.exec(linuxQemuX86Binary, ['--version']);
    } catch {
      return `Unable to run "${linuxQemuX86Binary} --version". ${installDisclaimer}`;
    }
    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      linuxQemuX86Binary,
      '-m',
      memorySize,
      '-nographic',
      '-cpu',
      'Broadwell-v4',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'e1000,netdev=usernet',
      '-snapshot',
      diskImage,
    ];
  }
}

class WindowsX86VMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'amd64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via our installation document';
    if (!fs.existsSync(windowsQemuX86Binary)) {
      return `QEMU x86 binary not found at ${windowsQemuX86Binary}. ${installDisclaimer}`;
    }

    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      `"${windowsQemuX86Binary}"`,
      '-m',
      memorySize,
      '-nographic',
      '-cpu',
      'Broadwell-v4',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'e1000,netdev=usernet',
      '-snapshot',
      `"${diskImage}"`,
    ];
  }
}

class WindowsArmVMManager extends VMManagerBase {
  public async checkVMLaunchPrereqs(): Promise<string | undefined> {
    const diskImage = this.getDiskImagePath();
    if (!fs.existsSync(diskImage)) {
      return `Raw disk image not found at ${diskImage}. Please build a .raw disk image first.`;
    }

    if (this.build.arch !== 'arm64') {
      return `Unsupported architecture: ${this.build.arch}`;
    }

    const installDisclaimer = 'Please install qemu via our installation document';
    if (!fs.existsSync(windowsQemuArm64Binary)) {
      return `QEMU arm64 binary not found at ${windowsQemuArm64Binary}. ${installDisclaimer}`;
    }

    return undefined;
  }

  protected generateLaunchCommand(diskImage: string): string[] {
    return [
      `"${windowsQemuArm64Binary}"`,
      '-m',
      memorySize,
      '-nographic',
      '-M',
      'virt',
      '-cpu',
      'max',
      '-smp',
      '4',
      '-serial',
      `websocket:127.0.0.1:${websocketPort},server,nowait`,
      '-pidfile',
      this.pidFile,
      '-netdev',
      `user,id=usernet,${hostForwarding}`,
      '-device',
      'virtio-net,netdev=usernet',
      '-snapshot',
      `"${diskImage}"`,
    ];
  }
}

// Factory function to create the appropriate VM Manager
export function createVMManager(build: BootcBuildInfo): VMManagerBase {
  // Only thing that we support is Mac M1 at the moment
  if (isMac() && isArm()) {
    if (build.arch === 'arm64') {
      return new MacArmNativeVMManager(build);
    } else if (build.arch === 'amd64') {
      return new MacArmX86VMManager(build);
    }
  } else if (isLinux()) {
    if (build.arch === 'arm64') {
      return new LinuxArmVMManager(build);
    } else if (build.arch === 'amd64') {
      return new LinuxX86VMManager(build);
    }
  } else if (isWindows()) {
    if (build.arch === 'amd64') {
      return new WindowsX86VMManager(build);
    } else if (build.arch === 'arm64') {
      return new WindowsArmVMManager(build);
    }
  }
  throw new Error('Unsupported OS or architecture');
}

// Function to stop the current VM
export async function stopCurrentVM(): Promise<void> {

  const pidFile = isWindows() ? windowsPidLocation : unixPidLocation;

  try {
    const pid = fs.readFileSync(pidFile, 'utf-8').trim();

    // Used for macOS and Linux
    if (isLinux() || isMac()) {
      await extensionApi.process.exec('sh', ['-c', `kill -9 ${pid}`]);
    } else if (isWindows()) {
      // Use taskkill to kill the process
      await extensionApi.process.exec('taskkill', ['/F', '/PID', pid]);
    }
  } catch (e: unknown) {
    if (e instanceof Error && 'stderr' in e && typeof e.stderr === 'string' && e.stderr.includes('No such process')) {
      return;
    }
    handleStdError(e);
  }
}

function handleStdError(e: unknown): void {
  console.log("DEBUG: ", e);
  if (e instanceof Error && 'stderr' in e) {
    throw new Error(typeof e.stderr === 'string' ? e.stderr : 'Unknown error');
  } else {
    throw new Error(`Unknown error ${e}`);
  }
}
