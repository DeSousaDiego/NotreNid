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
