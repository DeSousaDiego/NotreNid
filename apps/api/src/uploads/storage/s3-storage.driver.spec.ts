const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

import { ConfigService } from '@nestjs/config';

import { S3StorageDriver } from './s3-storage.driver';
import type { AppException } from '../../common/exceptions/app-exception';

function buildDriver(overrides: Record<string, string> = {}): S3StorageDriver {
  const config = new ConfigService({
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_REGION: 'eu-west-3',
    STORAGE_ENDPOINT: 'http://localhost:9000',
    STORAGE_ACCESS_KEY: 'key',
    STORAGE_SECRET_KEY: 'secret',
    ...overrides,
  });
  return new S3StorageDriver(config);
}

describe('S3StorageDriver', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('required configuration', () => {
    it.each(['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY', 'STORAGE_SECRET_KEY'])(
      'throws at construction time when %s is missing',
      (missingKey) => {
        expect(() => buildDriver({ [missingKey]: undefined as unknown as string })).toThrow();
      },
    );
  });

  describe('public URL resolution', () => {
    it('uploads and returns a path-style public URL when a custom endpoint is configured, no STORAGE_PUBLIC_URL (MinIO/Supabase Storage — legacy behavior preserved)', async () => {
      mockSend.mockResolvedValueOnce({});
      const driver = buildDriver();

      const result = await driver.save({
        buffer: Buffer.from('fake-image'),
        filename: 'abc.jpg',
        contentType: 'image/jpeg',
      });

      expect(result).toEqual({ id: 'abc.jpg', url: 'http://localhost:9000/test-bucket/abc.jpg' });
    });

    it('falls back to a virtual-hosted-style URL against real AWS S3 (no endpoint, no STORAGE_PUBLIC_URL)', async () => {
      mockSend.mockResolvedValueOnce({});
      const driver = buildDriver({ STORAGE_ENDPOINT: '' });

      const result = await driver.save({
        buffer: Buffer.from('fake-image'),
        filename: 'abc.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.url).toBe('https://test-bucket.s3.eu-west-3.amazonaws.com/abc.jpg');
    });

    it('uses STORAGE_PUBLIC_URL directly (no bucket segment) when set, e.g. Cloudflare R2 where the authenticated endpoint is never public', async () => {
      mockSend.mockResolvedValueOnce({});
      const driver = buildDriver({
        STORAGE_ENDPOINT: 'https://abcd1234.r2.cloudflarestorage.com',
        STORAGE_PUBLIC_URL: 'https://pub-abcd1234.r2.dev',
      });

      const result = await driver.save({
        buffer: Buffer.from('fake-image'),
        filename: 'abc.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.url).toBe('https://pub-abcd1234.r2.dev/abc.jpg');
    });

    it('strips a trailing slash from STORAGE_PUBLIC_URL', async () => {
      mockSend.mockResolvedValueOnce({});
      const driver = buildDriver({ STORAGE_PUBLIC_URL: 'https://pub-abcd1234.r2.dev/' });

      const result = await driver.save({
        buffer: Buffer.from('fake-image'),
        filename: 'abc.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.url).toBe('https://pub-abcd1234.r2.dev/abc.jpg');
    });

    it('prefers STORAGE_PUBLIC_URL over the endpoint-derived path-style URL when both are set', async () => {
      mockSend.mockResolvedValueOnce({});
      const driver = buildDriver({
        STORAGE_ENDPOINT: 'http://localhost:9000',
        STORAGE_PUBLIC_URL: 'https://cdn.example.test',
      });

      const result = await driver.save({
        buffer: Buffer.from('fake-image'),
        filename: 'abc.jpg',
        contentType: 'image/jpeg',
      });

      expect(result.url).toBe('https://cdn.example.test/abc.jpg');
    });
  });

  it('sends the upload to the configured bucket regardless of the public URL source', async () => {
    mockSend.mockResolvedValueOnce({});
    const driver = buildDriver({ STORAGE_PUBLIC_URL: 'https://cdn.example.test' });

    await driver.save({
      buffer: Buffer.from('fake-image'),
      filename: 'abc.jpg',
      contentType: 'image/jpeg',
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ Bucket: 'test-bucket' }) }),
    );
  });

  it('throws NOT_FOUND when removing an object that does not exist', async () => {
    mockSend.mockRejectedValueOnce(new Error('NotFound'));
    const driver = buildDriver();

    await expect(driver.remove('missing.jpg')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppException>);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('deletes an existing object after confirming it exists', async () => {
    mockSend.mockResolvedValueOnce({}); // HeadObjectCommand
    mockSend.mockResolvedValueOnce({}); // DeleteObjectCommand
    const driver = buildDriver();

    await driver.remove('abc.jpg');

    expect(mockSend).toHaveBeenCalledTimes(2);
  });
});
