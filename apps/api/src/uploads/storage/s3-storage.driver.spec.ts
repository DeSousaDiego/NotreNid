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

  it('uploads and returns a path-style public URL when a custom endpoint is configured (MinIO/Supabase Storage)', async () => {
    mockSend.mockResolvedValueOnce({});
    const driver = buildDriver();

    const result = await driver.save({
      buffer: Buffer.from('fake-image'),
      filename: 'abc.jpg',
      contentType: 'image/jpeg',
    });

    expect(result).toEqual({ id: 'abc.jpg', url: 'http://localhost:9000/test-bucket/abc.jpg' });
  });

  it('falls back to a virtual-hosted-style URL against real AWS S3 (no custom endpoint)', async () => {
    mockSend.mockResolvedValueOnce({});
    const driver = buildDriver({ STORAGE_ENDPOINT: '' });

    const result = await driver.save({
      buffer: Buffer.from('fake-image'),
      filename: 'abc.jpg',
      contentType: 'image/jpeg',
    });

    expect(result.url).toBe('https://test-bucket.s3.eu-west-3.amazonaws.com/abc.jpg');
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
