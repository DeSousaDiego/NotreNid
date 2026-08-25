export interface StorageDriver {
  save(file: { buffer: Buffer; filename: string; contentType: string }): Promise<{
    id: string;
    url: string;
  }>;
  remove(filename: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
