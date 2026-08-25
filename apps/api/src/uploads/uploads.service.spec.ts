import type { StorageDriver } from './storage/storage-driver.interface';
import { MAX_UPLOAD_SIZE_BYTES, UploadsService } from './uploads.service';
import type { AppException } from '../common/exceptions/app-exception';

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('UploadsService', () => {
  let driver: { save: jest.Mock; remove: jest.Mock };
  let service: UploadsService;

  beforeEach(() => {
    driver = { save: jest.fn(), remove: jest.fn() };
    service = new UploadsService(driver as unknown as StorageDriver);
  });

  describe('save', () => {
    it('rejects a file above the maximum size before touching the storage driver', async () => {
      await expect(
        service.save({ buffer: PNG_MAGIC_BYTES, size: MAX_UPLOAD_SIZE_BYTES + 1 }),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' } satisfies Partial<AppException>);
      expect(driver.save).not.toHaveBeenCalled();
    });

    it('rejects content whose signature does not match an accepted image format', async () => {
      await expect(
        service.save({ buffer: Buffer.from('not-an-image'), size: 12 }),
      ).rejects.toMatchObject({ code: 'INVALID_FILE_TYPE' } satisfies Partial<AppException>);
      expect(driver.save).not.toHaveBeenCalled();
    });

    it('delegates a valid PNG to the storage driver with a generated UUID filename', async () => {
      driver.save.mockResolvedValue({
        id: 'generated.png',
        url: 'https://example.test/generated.png',
      });

      const result = await service.save({ buffer: PNG_MAGIC_BYTES, size: PNG_MAGIC_BYTES.length });

      expect(driver.save).toHaveBeenCalledWith(
        expect.objectContaining({
          buffer: PNG_MAGIC_BYTES,
          contentType: 'image/png',
          filename: expect.stringMatching(/^[0-9a-f-]{36}\.png$/),
        }),
      );
      expect(result).toEqual({ id: 'generated.png', url: 'https://example.test/generated.png' });
    });
  });

  describe('remove', () => {
    it('rejects a filename that does not match the generated format, without calling the driver', async () => {
      await expect(service.remove('../../etc/passwd')).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      } satisfies Partial<AppException>);
      expect(driver.remove).not.toHaveBeenCalled();
    });

    it('delegates a well-formed filename to the storage driver', async () => {
      const filename = '11111111-1111-1111-1111-111111111111.jpg';
      driver.remove.mockResolvedValue(undefined);

      await service.remove(filename);

      expect(driver.remove).toHaveBeenCalledWith(filename);
    });
  });
});
