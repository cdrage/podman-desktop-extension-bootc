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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { bootcClient } from '/@/api/client';
import Dashboard from './Dashboard.svelte';
import type { ImageInfo } from '@podman-desktop/api';
import type { Subscriber } from '/@shared/src/messages/MessageProxy';

const mockBootcImages: ImageInfo[] = [
  {
    Id: 'registry.gitlab.com/fedora/bootc/examples/httpd',
    RepoTags: ['latest'],
    Labels: {
      bootc: 'true',
    },
    engineId: 'engine1',
    engineName: 'engine1',
    ParentId: 'parent1',
    Created: 0,
    VirtualSize: 0,
    Size: 0,
    Containers: 0,
    SharedSize: 0,
    Digest: 'sha256:1234567890abcdef',
  },
];

vi.mock('/@/api/client', async () => {
  return {
    bootcClient: {
      listHistoryInfo: vi.fn(),
      listBootcImages: vi.fn(),
      isMac: vi.fn(),
      isWindows: vi.fn(),
    },
    rpcBrowser: {
      subscribe: (): Subscriber => {
        return {
          unsubscribe: (): void => {},
        };
      },
    },
  };
});

test('Expect basic dashboard', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue([]);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue([]);
  render(Dashboard);

  const welcome = screen.getByText('Welcome to Bootable Containers');
  expect(welcome).toBeInTheDocument();
});

test('Expect resource sections', async () => {
  vi.mocked(bootcClient.listHistoryInfo).mockResolvedValue([]);
  vi.mocked(bootcClient.listBootcImages).mockResolvedValue(mockBootcImages);
  render(Dashboard);

  const images = screen.getByText('BootC Container Images');
  expect(images).toBeInTheDocument();

  const diskImages = screen.getByText('Disk Images');
  expect(diskImages).toBeInTheDocument();
});
