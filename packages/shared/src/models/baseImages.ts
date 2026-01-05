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

import onboardingConfig from './onboarding-config.json';

export interface BaseImage {
  id: string;
  name: string;
  description: string;
  image: string;
  tag: string;
}

export interface ContainerfileExample {
  id: string;
  name: string;
  description: string;
  category: string;
  containerfile: string;
}

export interface OnboardingConfig {
  baseImages: BaseImage[];
  examples: ContainerfileExample[];
}

// Export the config from JSON
export const BASE_IMAGES: BaseImage[] = onboardingConfig.baseImages;
export const CONTAINERFILE_EXAMPLES: ContainerfileExample[] = onboardingConfig.examples;

// Helper to generate a full Containerfile from base image and selected examples
export function generateContainerfile(baseImage: BaseImage, exampleIds: string[]): string {
  const fromLine = `FROM ${baseImage.image}:${baseImage.tag}\n`;

  if (exampleIds.length === 0) {
    return `${fromLine}
# Add your customizations here
# Example: Install packages
# RUN dnf install -y vim htop

# Example: Enable services
# RUN systemctl enable my-service
`;
  }

  const examples = exampleIds
    .map(id => CONTAINERFILE_EXAMPLES.find(e => e.id === id))
    .filter((e): e is ContainerfileExample => e !== undefined);

  const exampleContent = examples.map(e => `\n${e.containerfile}`).join('\n');

  return `${fromLine}${exampleContent}
`;
}
