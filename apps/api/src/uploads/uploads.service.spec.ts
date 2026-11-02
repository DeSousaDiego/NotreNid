import { HttpStatus } from '@nestjs/common';

import type { StorageDriver } from './storage/storage-driver.interface';
import { MAX_UPLOAD_SIZE_BYTES, UploadsService } from './uploads.service';
import { AppException } from '../common/exceptions/app-exception';
import type { PrismaService } from '../prisma/prisma.service';

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STORAGE_KEY = '11111111-1111-1111-1111-111111111111.png';
const HOUSEHOLD_A = 'household-a';
const HOUSEHOLD_B = 'household-b';

describe('UploadsService', () => {
  let driver: { save: jest.Mock; remove: jest.Mock };
  let prisma: { upload: { create: jest.Mock; findFirst: jest.Mock; deleteMany: jest.Mock } };
  let service: UploadsService;

  beforeEach(() => {
    driver = { save: jest.fn(), remove: jest.fn() };
    prisma = { upload: { create: jest.fn(), findFirst: jest.fn(), deleteMany: jest.fn() } };
    service = new UploadsService(
      driver as unknown as StorageDriver,
      prisma as unknown as PrismaService,
    );
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
      expect(prisma.upload.create).not.toHaveBeenCalled();
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

  describe('createHouseholdUpload', () => {
    beforeEach(() => {
      driver.save.mockResolvedValue({ id: STORAGE_KEY, url: `https://cdn.test/${STORAGE_KEY}` });
    });

    it('records the upload with the route household and the authenticated author, and returns the record id', async () => {
      prisma.upload.create.mockResolvedValue({ id: 'upload-1' });

      const result = await service.createHouseholdUpload(HOUSEHOLD_A, 'user-1', {
        buffer: PNG_MAGIC_BYTES,
        size: PNG_MAGIC_BYTES.length,
      });

      expect(prisma.upload.create).toHaveBeenCalledWith({
        data: {
          storageKey: STORAGE_KEY,
          householdId: HOUSEHOLD_A,
          uploadedById: 'user-1',
          kind: 'ITEM_COVER',
          contentType: 'image/png',
          sizeBytes: PNG_MAGIC_BYTES.length,
        },
      });
      expect(result).toEqual({ id: 'upload-1', url: `https://cdn.test/${STORAGE_KEY}` });
    });

    it('removes the stored file when the database write fails, then rethrows', async () => {
      const dbError = new Error('db down');
      prisma.upload.create.mockRejectedValue(dbError);
      driver.remove.mockResolvedValue(undefined);

      await expect(
        service.createHouseholdUpload(HOUSEHOLD_A, 'user-1', {
          buffer: PNG_MAGIC_BYTES,
          size: PNG_MAGIC_BYTES.length,
        }),
      ).rejects.toBe(dbError);
      expect(driver.remove).toHaveBeenCalledWith(STORAGE_KEY);
    });

    it('still rethrows the database error when the compensation also fails', async () => {
      const dbError = new Error('db down');
      prisma.upload.create.mockRejectedValue(dbError);
      driver.remove.mockRejectedValue(new Error('storage down'));

      await expect(
        service.createHouseholdUpload(HOUSEHOLD_A, 'user-1', {
          buffer: PNG_MAGIC_BYTES,
          size: PNG_MAGIC_BYTES.length,
        }),
      ).rejects.toBe(dbError);
    });

    it('writes nothing in the database when storage fails', async () => {
      driver.save.mockRejectedValue(new Error('storage down'));

      await expect(
        service.createHouseholdUpload(HOUSEHOLD_A, 'user-1', {
          buffer: PNG_MAGIC_BYTES,
          size: PNG_MAGIC_BYTES.length,
        }),
      ).rejects.toThrow('storage down');
      expect(prisma.upload.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteHouseholdUpload', () => {
    it('looks the upload up by id AND household, then deletes storage before the row', async () => {
      prisma.upload.findFirst.mockResolvedValue({ id: 'upload-1', storageKey: STORAGE_KEY });
      const calls: string[] = [];
      driver.remove.mockImplementation(async () => {
        calls.push('storage');
      });
      prisma.upload.deleteMany.mockImplementation(async () => {
        calls.push('db');
        return { count: 1 };
      });

      await service.deleteHouseholdUpload(HOUSEHOLD_A, 'upload-1');

      expect(prisma.upload.findFirst).toHaveBeenCalledWith({
        where: { id: 'upload-1', householdId: HOUSEHOLD_A },
      });
      expect(driver.remove).toHaveBeenCalledWith(STORAGE_KEY);
      expect(prisma.upload.deleteMany).toHaveBeenCalledWith({
        where: { id: 'upload-1', householdId: HOUSEHOLD_A },
      });
      expect(calls).toEqual(['storage', 'db']);
    });

    it.each([
      ['an upload of another household', 'upload-of-b'],
      ['an unknown upload id', 'does-not-exist'],
      ['a legacy storage key used as id', STORAGE_KEY],
    ])('answers 404 for %s without touching storage', async (_label, uploadId) => {
      prisma.upload.findFirst.mockResolvedValue(null);

      await expect(service.deleteHouseholdUpload(HOUSEHOLD_B, uploadId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      } satisfies Partial<AppException>);
      expect(driver.remove).not.toHaveBeenCalled();
      expect(prisma.upload.deleteMany).not.toHaveBeenCalled();
    });

    it('keeps the row when storage deletion fails, so the deletion can be retried', async () => {
      prisma.upload.findFirst.mockResolvedValue({ id: 'upload-1', storageKey: STORAGE_KEY });
      driver.remove.mockRejectedValue(new Error('storage down'));

      await expect(service.deleteHouseholdUpload(HOUSEHOLD_A, 'upload-1')).rejects.toThrow(
        'storage down',
      );
      expect(prisma.upload.deleteMany).not.toHaveBeenCalled();
    });

    it('still deletes the row when the file is already gone from storage', async () => {
      prisma.upload.findFirst.mockResolvedValue({ id: 'upload-1', storageKey: STORAGE_KEY });
      driver.remove.mockRejectedValue(
        new AppException(HttpStatus.NOT_FOUND, 'NOT_FOUND', "Ce fichier n'existe pas."),
      );
      prisma.upload.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteHouseholdUpload(HOUSEHOLD_A, 'upload-1');

      expect(prisma.upload.deleteMany).toHaveBeenCalled();
    });
  });
});
