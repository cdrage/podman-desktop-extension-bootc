/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { expect, test, vi, beforeEach } from 'vitest';
import examplesCatalog from '../assets/examples.json';
import type { ExamplesList } from '/@shared/src/models/examples';
import { BootcApiImpl } from './api-impl';
import * as podmanDesktopApi from '@podman-desktop/api';
import type * as macadam from '@crc-org/macadam.js';
import { MacadamHandler } from './macadam';

const TELEMETRY_LOGGER_MOCK: podmanDesktopApi.TelemetryLogger = {
  logUsage: vi.fn(),
} as unknown as podmanDesktopApi.TelemetryLogger;

vi.mock(
  import('@podman-desktop/api'),
  () =>
    ({
      window: {
        showErrorMessage: vi.fn(),
        showOpenDialog: vi.fn(),
      },
      containerEngine: {
        listImages: vi.fn(),
        listContainers: vi.fn(),
        deleteImage: vi.fn(),
        createContainer: vi.fn(),
      },
      navigation: {
        navigateToContainerTerminal: vi.fn(),
        navigateToContainer: vi.fn(),
      },
      env: {
        openExternal: vi.fn(),
        createTelemetryLogger: vi.fn(),
        clipboard: {
          writeText: vi.fn(),
        },
      },
    }) as unknown as typeof podmanDesktopApi,
);

vi.mock(
  import('@crc-org/macadam.js'),
  () =>
    ({
      Macadam: vi.fn(
        class {
          createVm = vi.fn();
          init = vi.fn();
          listVms = vi.fn();
        },
      ),
    }) as unknown as typeof macadam,
);

beforeEach(() => {
  vi.resetAllMocks();
});

function createAPI(): BootcApiImpl {
  const postMessageMock = vi.fn().mockResolvedValue(undefined);

  return new BootcApiImpl({} as podmanDesktopApi.ExtensionContext, TELEMETRY_LOGGER_MOCK, {
    postMessage: postMessageMock,
  } as unknown as podmanDesktopApi.Webview);
}

test('getExamples should return examplesCatalog', async () => {
  const extensionContextMock = {
    storagePath: '/fake-path',
  } as unknown as podmanDesktopApi.ExtensionContext;

  const webviewMock = {} as podmanDesktopApi.Webview;

  const bootcApi = new BootcApiImpl(extensionContextMock, TELEMETRY_LOGGER_MOCK, webviewMock);

  // When running get Examples we should return the examplesCatalog (it's exported)
  const result = await bootcApi.getExamples();
  // Check that the examples and categories are NOT empty
  expect(result.examples.length).not.toBe(0);
  expect(result.categories.length).not.toBe(0);

  expect(result).toEqual(examplesCatalog as ExamplesList);
});

test('listContainers should return list from extension api', async () => {
  const containers = [{}, {}] as podmanDesktopApi.ContainerInfo[];

  vi.mocked(podmanDesktopApi.containerEngine.listContainers).mockResolvedValue(containers);

  const apiImpl = createAPI();
  const result = await apiImpl.listContainers();

  expect(podmanDesktopApi.containerEngine.listContainers).toHaveBeenCalled();
  expect(result.length).toBe(2);
});

test('deleteImage should call the extension api and fire event', async () => {
  const postMessageMock = vi.fn().mockResolvedValue(undefined);

  const apiImpl = new BootcApiImpl({} as podmanDesktopApi.ExtensionContext, TELEMETRY_LOGGER_MOCK, {
    postMessage: postMessageMock,
  } as unknown as podmanDesktopApi.Webview);

  await apiImpl.deleteImage('a', 'b');

  expect(podmanDesktopApi.containerEngine.deleteImage).toHaveBeenCalledWith('a', 'b');
  expect(postMessageMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'image-update' }));
});

test('createVM should call the extension api', async () => {
  // Mock createVM as we are only interested if the function is ACTUALLY called.
  vi.spyOn(MacadamHandler.prototype, 'createVm').mockResolvedValue(undefined);

  const apiImpl = createAPI();

  const options = {
    imagePath: '~/foobar',
    sshIdentityPath: '~/foobar/id_ed25519',
    username: 'foobar',
  } as macadam.CreateVmOptions;

  await apiImpl.createVM(options);

  // Check that the createVm methods were called
  expect(MacadamHandler.prototype.createVm).toHaveBeenCalledWith(options);
});

test('check createVM passes underlying error message', async () => {
  vi.spyOn(MacadamHandler.prototype, 'createVm').mockRejectedValue('failed');

  const apiImpl = createAPI();

  try {
    await apiImpl.createVM({} as macadam.CreateVmOptions);
  } catch (e) {
    expect(e).toEqual('failed');
  }
});

test('listVMs should call the extension api', async () => {
  vi.spyOn(MacadamHandler.prototype, 'listVms').mockResolvedValue([{ name: 'foobar' } as unknown as macadam.VmDetails]);

  const apiImpl = createAPI();

  await apiImpl.listVMs();

  // Check that the createVm methods were called
  expect(MacadamHandler.prototype.listVms).toHaveBeenCalled();
});

test('check listVMs passes underlying error message', async () => {
  vi.spyOn(MacadamHandler.prototype, 'listVms').mockRejectedValue('list failed');

  const apiImpl = createAPI();

  try {
    await apiImpl.listVMs();
  } catch (e) {
    expect(e).toEqual('list failed');
  }
});

test('selectVMImageFile should call the extension api', async () => {
  const apiImpl = createAPI();

  await apiImpl.selectVMImageFile();

  expect(podmanDesktopApi.window.showOpenDialog).toHaveBeenCalled();
});

test('testBootcImage with bash mode should create container with bash command', async () => {
  const containerId = 'test-container-id';
  vi.mocked(podmanDesktopApi.containerEngine.createContainer).mockResolvedValue({
    id: containerId,
    engineId: 'podman-engine',
  });
  vi.mocked(podmanDesktopApi.containerEngine.listContainers).mockResolvedValue([
    { Id: containerId, State: 'running' } as unknown as podmanDesktopApi.ContainerInfo,
  ]);

  const apiImpl = createAPI();

  await apiImpl.testBootcImage('quay.io/test/image:latest', 'podman-engine', 'bash');

  expect(podmanDesktopApi.containerEngine.createContainer).toHaveBeenCalledWith(
    'podman-engine',
    expect.objectContaining({
      Image: 'quay.io/test/image:latest',
      Tty: true,
      OpenStdin: true,
      Cmd: ['/bin/bash'],
    }),
  );
  expect(podmanDesktopApi.navigation.navigateToContainerTerminal).toHaveBeenCalledWith(containerId);
});

test('testBootcImage with systemd mode should create privileged container with /sbin/init', async () => {
  const containerId = 'test-container-id';
  vi.mocked(podmanDesktopApi.containerEngine.createContainer).mockResolvedValue({
    id: containerId,
    engineId: 'podman-engine',
  });
  vi.mocked(podmanDesktopApi.containerEngine.listContainers).mockResolvedValue([
    { Id: containerId, State: 'running' } as unknown as podmanDesktopApi.ContainerInfo,
  ]);

  const apiImpl = createAPI();

  await apiImpl.testBootcImage('quay.io/test/image:latest', 'podman-engine', 'systemd');

  expect(podmanDesktopApi.containerEngine.createContainer).toHaveBeenCalledWith(
    'podman-engine',
    expect.objectContaining({
      Image: 'quay.io/test/image:latest',
      Tty: true,
      OpenStdin: true,
      Cmd: ['/sbin/init'],
      HostConfig: {
        Privileged: true,
        Binds: ['/sys:/sys:ro'],
      },
    }),
  );
  expect(podmanDesktopApi.navigation.navigateToContainerTerminal).toHaveBeenCalledWith(containerId);
});

test('testBootcImage should show error message on failure', async () => {
  const error = new Error('Container creation failed');
  vi.mocked(podmanDesktopApi.containerEngine.createContainer).mockRejectedValue(error);

  const apiImpl = createAPI();

  await expect(apiImpl.testBootcImage('quay.io/test/image:latest', 'podman-engine', 'bash')).rejects.toThrow(error);

  expect(podmanDesktopApi.window.showErrorMessage).toHaveBeenCalledWith(
    expect.stringContaining('Error testing bootc image'),
  );
});
