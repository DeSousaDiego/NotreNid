import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { UploadsService } from '../uploads/uploads.service';

describe('UsersService', () => {
  let prisma: {
    user: {
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
  };
  let uploads: { save: jest.Mock; remove: jest.Mock };
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
    };
    uploads = { save: jest.fn(), remove: jest.fn() };
    service = new UsersService(
      prisma as unknown as PrismaService,
      uploads as unknown as UploadsService,
    );
  });

  describe('updateProfile', () => {
    it('updates only the display name', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'alix@example.com',
        displayName: 'Alix B.',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateProfile('u1', { displayName: 'Alix B.' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { displayName: 'Alix B.' },
      });
      expect(result.displayName).toBe('Alix B.');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateAvatar', () => {
    const newUser = {
      id: 'u1',
      email: 'alix@example.com',
      displayName: 'Alix',
      avatarUrl: 'https://cdn.test/new.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('persists the new avatar and removes the previous file once the DB write succeeds', async () => {
      uploads.save.mockResolvedValue({ id: 'new.jpg', url: 'https://cdn.test/new.jpg' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: 'old.jpg' });
      prisma.user.update.mockResolvedValue(newUser);
      uploads.remove.mockResolvedValue(undefined);

      await service.updateAvatar('u1', { buffer: Buffer.from('x'), size: 1 });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatarUrl: 'https://cdn.test/new.jpg', avatarUploadId: 'new.jpg' },
      });
      expect(uploads.remove).toHaveBeenCalledWith('old.jpg');
    });

    it('does not call remove when there was no previous avatar', async () => {
      uploads.save.mockResolvedValue({ id: 'new.jpg', url: 'https://cdn.test/new.jpg' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: null });
      prisma.user.update.mockResolvedValue(newUser);

      await service.updateAvatar('u1', { buffer: Buffer.from('x'), size: 1 });

      expect(uploads.remove).not.toHaveBeenCalled();
    });

    it('cleans up the newly uploaded file and leaves the previous avatar untouched if the DB write fails', async () => {
      uploads.save.mockResolvedValue({ id: 'new.jpg', url: 'https://cdn.test/new.jpg' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: 'old.jpg' });
      prisma.user.update.mockRejectedValue(new Error('db down'));
      uploads.remove.mockResolvedValue(undefined);

      await expect(
        service.updateAvatar('u1', { buffer: Buffer.from('x'), size: 1 }),
      ).rejects.toThrow('db down');

      expect(uploads.remove).toHaveBeenCalledTimes(1);
      expect(uploads.remove).toHaveBeenCalledWith('new.jpg');
      expect(uploads.remove).not.toHaveBeenCalledWith('old.jpg');
    });

    it('does not fail the request when best-effort cleanup of the previous avatar throws', async () => {
      uploads.save.mockResolvedValue({ id: 'new.jpg', url: 'https://cdn.test/new.jpg' });
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: 'old.jpg' });
      prisma.user.update.mockResolvedValue(newUser);
      uploads.remove.mockRejectedValue(new Error('storage unreachable'));

      await expect(
        service.updateAvatar('u1', { buffer: Buffer.from('x'), size: 1 }),
      ).resolves.toMatchObject({ avatarUrl: 'https://cdn.test/new.jpg' });
    });
  });

  describe('removeAvatar', () => {
    it('clears the avatar fields and removes the file when one was set', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: 'old.jpg' });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'alix@example.com',
        displayName: 'Alix',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      uploads.remove.mockResolvedValue(undefined);

      await service.removeAvatar('u1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatarUrl: null, avatarUploadId: null },
      });
      expect(uploads.remove).toHaveBeenCalledWith('old.jpg');
    });

    it('does not call remove when there was no avatar to begin with', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ avatarUploadId: null });
      prisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'alix@example.com',
        displayName: 'Alix',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.removeAvatar('u1');

      expect(uploads.remove).not.toHaveBeenCalled();
    });
  });
});
