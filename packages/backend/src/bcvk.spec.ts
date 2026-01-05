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
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as extensionApi from '@podman-desktop/api';

// Use vi.hoisted for mocks that need to be referenced in vi.mock factories
const { fsMock, processExecMock, withProgressMock } = vi.hoisted(() => ({
  fsMock: {
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    chmod: vi.fn(),
    unlink: vi.fn(),
    rename: vi.fn(),
  },
  processExecMock: vi.fn(),
  withProgressMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    promises: fsMock,
    existsSync: vi.fn(),
  },
  promises: fsMock,
  existsSync: vi.fn(),
}));

// Mock os module - returns linux-x64 which is supported
vi.mock('node:os', () => ({
  default: {
    platform: () => 'linux',
    arch: () => 'x64',
  },
  platform: () => 'linux',
  arch: () => 'x64',
}));

vi.mock(
  import('@podman-desktop/api'),
  () =>
    ({
      env: {
        isLinux: true,
        isMac: false,
        isWindows: false,
      },
      window: {
        withProgress: withProgressMock,
        showErrorMessage: vi.fn(),
      },
      process: {
        exec: processExecMock,
      },
      ProgressLocation: {
        TASK_WIDGET: 'TASK_WIDGET',
      },
    }) as unknown as typeof extensionApi,
);

// Import after mocks are set up
import { BcvkDownload, BcvkHandler } from './bcvk';

const TELEMETRY_LOGGER_MOCK: extensionApi.TelemetryLogger = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as extensionApi.TelemetryLogger;

const EXTENSION_CONTEXT_MOCK: extensionApi.ExtensionContext = {
  storagePath: '/tmp/bcvk-test-storage',
  subscriptions: [],
} as unknown as extensionApi.ExtensionContext;

beforeEach(() => {
  vi.clearAllMocks();
  fsMock.access.mockRejectedValue(new Error('ENOENT'));
});

describe('BcvkDownload', () => {
  test('getBcvkExtensionPath returns correct path', () => {
    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    expect(bcvkDownload.getBcvkExtensionPath()).toBe('/tmp/bcvk-test-storage/bcvk');
  });

  test('isSupportedPlatform returns true for Linux x64', () => {
    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    expect(bcvkDownload.isSupportedPlatform()).toBe(true);
  });

  test('getAssetNameForPlatform returns correct asset name for Linux x64', () => {
    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    expect(bcvkDownload.getAssetNameForPlatform()).toBe('bcvk-x86_64-unknown-linux-gnu.tar.gz');
  });

  test('findBcvk returns undefined when binary not found', async () => {
    fsMock.access.mockRejectedValue(new Error('ENOENT'));

    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    const result = await bcvkDownload.findBcvk();
    expect(result).toBeUndefined();
  });

  test('getBcvkExtensionPath is used to check extension storage', async () => {
    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    const extensionPath = bcvkDownload.getBcvkExtensionPath();
    expect(extensionPath).toContain('bcvk');
    expect(extensionPath).toContain(EXTENSION_CONTEXT_MOCK.storagePath);
  });

  test('getBcvkVersion parses version correctly', async () => {
    processExecMock.mockResolvedValue({
      stdout: 'bcvk 0.9.0',
      stderr: '',
      command: 'bcvk --version',
    });

    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    const version = await bcvkDownload.getBcvkVersion('/path/to/bcvk');
    expect(version).toBe('0.9.0');
  });

  test('getBcvkVersion returns unknown on error', async () => {
    processExecMock.mockRejectedValue(new Error('Command failed'));

    const bcvkDownload = new BcvkDownload(EXTENSION_CONTEXT_MOCK);
    const version = await bcvkDownload.getBcvkVersion('/path/to/bcvk');
    expect(version).toBe('unknown');
  });
});

describe('BcvkHandler', () => {
  test('isSupportedPlatform returns true for Linux x64', () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);
    expect(handler.isSupportedPlatform()).toBe(true);
  });

  test('isAvailable returns false when bcvk not initialized', () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);
    expect(handler.isAvailable()).toBe(false);
  });

  test('getBinaryInfo returns undefined when bcvk not available', async () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);
    const info = await handler.getBinaryInfo();
    expect(info).toBeUndefined();
  });

  test('getBcvkDownload returns the download instance', () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);
    const download = handler.getBcvkDownload();
    expect(download).toBeInstanceOf(BcvkDownload);
  });

  test('setBcvkPath sets the path and makes it available', () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);
    expect(handler.isAvailable()).toBe(false);

    handler.setBcvkPath('/path/to/bcvk');
    expect(handler.isAvailable()).toBe(true);
    expect(handler.getBcvkPath()).toBe('/path/to/bcvk');
  });

  test('runEphemeralVM throws when bcvk not installed', async () => {
    const handler = new BcvkHandler(EXTENSION_CONTEXT_MOCK, TELEMETRY_LOGGER_MOCK);

    await expect(handler.runEphemeralVM('test-image')).rejects.toThrow('bcvk is not installed');
  });
});
