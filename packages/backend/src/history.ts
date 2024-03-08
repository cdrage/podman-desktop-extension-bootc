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
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import type { BootcBuildInfo } from '@shared/src/models/bootc';

const filename = 'history.json';

export class History {
  public infos: BootcBuildInfo[] = [];

  constructor(private readonly storagePath: string) {}

  async loadFile(): Promise<void> {
    const filePath = path.resolve(this.storagePath, filename);
    if (existsSync(filePath)) {
      try {
        const infoBuffer = await readFile(filePath, 'utf8');
        this.infos = JSON.parse(infoBuffer);
      } catch (err) {
        console.error('Error loading file:', err);
      }
    }
  }

  public async addOrUpdateBuildInfo(buildInfo: BootcBuildInfo): Promise<void> {
    const index = this.infos.findIndex(
      info =>
        info.name === buildInfo.name &&
        info.type === buildInfo.type &&
        info.arch === buildInfo.arch &&
        info.tag === buildInfo.tag,
    );
    if (index !== -1) {
      this.infos[index] = { ...this.infos[index], ...buildInfo };
    } else {
      buildInfo.timestamp = new Date().toISOString(); // Ensure timestamp is set for new entries
      this.infos.unshift(buildInfo);
    }
    if (this.infos.length > 100) {
      this.infos.length = 100; // Keep the history size manageable
    }
    await this.saveFile();
  }

  public async removeBuildInfo(buildInfo: Pick<BootcBuildInfo, 'name' | 'tag' | 'type' | 'arch'>): Promise<void> {
    this.infos = this.infos.filter(
      info =>
        !(
          info.name === buildInfo.name &&
          info.type === buildInfo.type &&
          info.arch === buildInfo.arch &&
          info.tag === buildInfo.tag
        ),
    );
    await this.saveFile();
  }

  private async saveFile(): Promise<void> {
    try {
      await mkdir(this.storagePath, { recursive: true });
      const filePath = path.resolve(this.storagePath, filename);
      await writeFile(filePath, JSON.stringify(this.infos, null, 2));
    } catch (err) {
      console.error('Error saving file:', err);
    }
  }

  public getLastFolder(): string | undefined {
    if (this.infos.length === 0) {
      return undefined;
    } else {
      return this.infos[0].folder;
    }
  }
}
