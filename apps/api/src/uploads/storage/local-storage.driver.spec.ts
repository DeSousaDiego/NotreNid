const mkdirMock = jest.fn();
const writeFileMock = jest.fn();
const statMock = jest.fn();
const rmMock = jest.fn();

jest.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mkdirMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  stat: (...args: unknown[]) => statMock(...args),
  rm: (...args: unknown[]) => rmMock(...args),
}));

import { ConfigService } from '@nestjs/config';

import { LocalStorageDriver } from './local-storage.driver';
import type { AppException } from '../../common/exceptions/app-exception';

describe('LocalStorageDriver', () => {
  let driver: LocalStorageDriver;

  beforeEach(() => {
    mkdirMock.mockReset().mockResolvedValue(undefined);
    writeFileMock.mockReset().mockResolvedValue(undefined);
    statMock.mockReset();
    rmMock.mockReset().mockResolvedValue(undefined);
    driver = new LocalStorageDriver(new ConfigService({ API_PUBLIC_URL: 'http://localhost:3000' }));
  });

  it('writes the file to disk and returns a URL built from API_PUBLIC_URL', async () => {
    const result = await driver.save({
      buffer: Buffer.from('fake-image'),
      filename: 'abc.jpg',
      contentType: 'image/jpeg',
    });

    expect(writeFileMock).toHaveBeenCalledWith(
      expect.stringContaining('abc.jpg'),
      Buffer.from('fake-image'),
    );
    expect(result).toEqual({ id: 'abc.jpg', url: 'http://localhost:3000/uploads/abc.jpg' });
  });

  it('normalizes a trailing slash in API_PUBLIC_URL (no double slash in the image URL)', async () => {
    const lanDriver = new LocalStorageDriver(
      new ConfigService({ API_PUBLIC_URL: 'http://192.168.1.10:3000/' }),
    );
    const result = await lanDriver.save({
      buffer: Buffer.from('x'),
      filename: 'f.png',
      contentType: 'image/png',
    });
    expect(result.url).toBe('http://192.168.1.10:3000/uploads/f.png');
  });

  it('keeps the historical relative URL when API_PUBLIC_URL is unset (and warns at startup)', async () => {
    const result = await new LocalStorageDriver(new ConfigService({})).save({
      buffer: Buffer.from('x'),
      filename: 'f.png',
      contentType: 'image/png',
    });
    expect(result.url).toBe('/uploads/f.png');
  });

  it('throws NOT_FOUND when removing a file that does not exist on disk', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'));

    await expect(driver.remove('missing.jpg')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } satisfies Partial<AppException>);
    expect(rmMock).not.toHaveBeenCalled();
  });

  it('deletes an existing file', async () => {
    statMock.mockResolvedValue({});

    await driver.remove('abc.jpg');

    expect(rmMock).toHaveBeenCalledWith(expect.stringContaining('abc.jpg'));
  });
});
