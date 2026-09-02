import { UsersController } from './users.controller';
import type { UsersService } from './users.service';
import type { AuthenticatedUser } from '../common/types/authenticated-request';

describe('UsersController', () => {
  let usersService: {
    updateProfile: jest.Mock;
    updateAvatar: jest.Mock;
    removeAvatar: jest.Mock;
  };
  let controller: UsersController;

  beforeEach(() => {
    usersService = {
      updateProfile: jest.fn().mockResolvedValue({}),
      updateAvatar: jest.fn().mockResolvedValue({}),
      removeAvatar: jest.fn().mockResolvedValue({}),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  // Isolation : la route n'accepte aucun identifiant de client (pas de :userId, pas de champ
  // id dans le DTO) — le seul utilisateur qu'un appelant peut jamais modifier est celui que le
  // JwtAuthGuard a authentifié. Un id arbitraire envoyé par le client ne peut donc pas être pris
  // en compte, même s'il apparaissait dans le body (le DTO ne le porte de toute façon pas).
  const currentUser: AuthenticatedUser = { id: 'authenticated-user-1' } as AuthenticatedUser;

  it('always updates the profile of the JWT-authenticated user, never a client-supplied id', () => {
    controller.updateProfile(currentUser, { displayName: 'Alix B.' });

    expect(usersService.updateProfile).toHaveBeenCalledWith('authenticated-user-1', {
      displayName: 'Alix B.',
    });
  });

  it('always targets the JWT-authenticated user for avatar upload', () => {
    const file = { buffer: Buffer.from('x') } as Express.Multer.File;

    controller.updateAvatar(currentUser, file);

    expect(usersService.updateAvatar).toHaveBeenCalledWith('authenticated-user-1', file);
  });

  it('rejects an avatar upload with no file, before reaching the service', () => {
    expect(() => controller.updateAvatar(currentUser, undefined)).toThrow();
    expect(usersService.updateAvatar).not.toHaveBeenCalled();
  });

  it('always targets the JWT-authenticated user for avatar removal', () => {
    controller.removeAvatar(currentUser);

    expect(usersService.removeAvatar).toHaveBeenCalledWith('authenticated-user-1');
  });
});
