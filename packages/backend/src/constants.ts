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

// Image related
export const bootcImageBuilder = 'bootc-image-builder';
export const bootcImageBuilderCentos =
  'quay.io/centos-bootc/bootc-image-builder:sha256-c2d6830647c095e29c8cabd1ef6ae0e903e77675b953655428ac5cef147541a0';

export const bootcImageBuilderRHEL9 = 'registry.redhat.io/rhel9/bootc-image-builder:9.7';
export const bootcImageBuilderRHEL10 = 'registry.redhat.io/rhel10/bootc-image-builder:10.1';
export const macadamName = 'bootc';

// bcvk (Bootc Virtualization Kit) related constants
export const BCVK_BINARY_NAME = 'bcvk';
export const BCVK_GITHUB_OWNER = 'bootc-dev';
export const BCVK_GITHUB_REPO = 'bcvk';
export const BCVK_DISPLAY_NAME = 'bcvk';
export const BCVK_DESCRIPTION = 'Bootc Virtualization Kit - Launch ephemeral VMs from bootc containers';

// Platform support for bcvk - currently only Linux x86_64
// Maps Node.js os.platform()-os.arch() to GitHub release asset names
export const BCVK_SUPPORTED_PLATFORMS: Record<string, string> = {
  'linux-x64': 'bcvk-x86_64-unknown-linux-gnu.tar.gz',
  // Future platforms can be added here when bcvk releases them:
  // 'linux-arm64': 'bcvk-aarch64-unknown-linux-gnu.tar.gz',
  // 'darwin-x64': 'bcvk-x86_64-apple-darwin.tar.gz',
  // 'darwin-arm64': 'bcvk-aarch64-apple-darwin.tar.gz',
};
