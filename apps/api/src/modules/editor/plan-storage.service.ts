import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredFileInfo {
  path: string;
  size: number;
  mimeType: string;
}

@Injectable()
export class PlanStorageService {
  private readonly rootDir: string;

  readonly maxUploadBytes: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.rootDir = path.resolve(config.getOrThrow<string>('STORAGE_DIR'));
    this.maxUploadBytes =
      config.getOrThrow<number>('MAX_UPLOAD_MB') * 1024 * 1024;
  }

  async save(buffer: Buffer, extension: string): Promise<string> {
    const key = path.posix.join('plans', `${randomUUID()}.${extension}`);
    const filePath = this.resolveKey(key);

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer, { flag: 'wx' });

    return key;
  }

  async getInfo(
    key: string,
    mimeType: string,
  ): Promise<StoredFileInfo | null> {
    try {
      const filePath = this.resolveKey(key);
      const info = await stat(filePath);

      if (!info.isFile()) {
        return null;
      }

      return { path: filePath, size: info.size, mimeType };
    } catch {
      return null;
    }
  }

  async remove(key: string | null): Promise<void> {
    if (!key) {
      return;
    }

    try {
      await unlink(this.resolveKey(key));
    } catch {
      // Removing a stale file is best-effort; the database remains authoritative.
    }
  }

  private resolveKey(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    const rootPrefix = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : `${this.rootDir}${path.sep}`;

    if (!resolved.startsWith(rootPrefix)) {
      throw new Error('Invalid storage key');
    }

    return resolved;
  }
}
