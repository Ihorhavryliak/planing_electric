import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  STORAGE_DRIVER,
  type StorageDriver,
} from '../../common/storage/storage-driver';

export interface StoredFileInfo {
  data: Buffer;
  size: number;
  mimeType: string;
}

@Injectable()
export class PlanStorageService {
  readonly maxUploadBytes: number;

  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.maxUploadBytes =
      config.getOrThrow<number>('MAX_UPLOAD_MB') * 1024 * 1024;
  }

  save(buffer: Buffer, extension: string): Promise<string> {
    return this.driver.save(buffer, extension);
  }

  async getInfo(
    key: string,
    mimeType: string,
  ): Promise<StoredFileInfo | null> {
    const data = await this.driver.getBuffer(key);
    if (!data) {
      return null;
    }
    return { data, size: data.byteLength, mimeType };
  }

  remove(key: string | null): Promise<void> {
    return this.driver.remove(key);
  }
}