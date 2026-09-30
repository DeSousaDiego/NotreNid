import { ApiError, NetworkError } from '@notre-nid/api-client';

import { getErrorMessage } from './errorMessage';

describe('getErrorMessage', () => {
  it('retourne le message d’une NetworkError', () => {
    const error = new NetworkError();
    expect(getErrorMessage(error)).toBe(error.message);
  });

  it('retourne le message d’une ApiError', () => {
    const error = new ApiError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Les données envoyées sont invalides.',
      details: [],
    });
    expect(getErrorMessage(error)).toBe('Les données envoyées sont invalides.');
  });

  it('traduit LAST_OWNER_CANNOT_LEAVE sans vocabulaire technique', () => {
    const error = new ApiError({
      statusCode: 409,
      code: 'LAST_OWNER_CANNOT_LEAVE',
      message:
        "Le dernier propriétaire d'un household ne peut ni le quitter ni être rétrogradé/retiré.",
      details: [],
    });
    const message = getErrorMessage(error);
    expect(message).toBe(
      'Vous êtes la seule personne responsable de ce foyer : confiez-le d’abord à quelqu’un d’autre.',
    );
    expect(message).not.toMatch(/household/i);
  });

  it('retourne un message générique pour une erreur inconnue', () => {
    expect(getErrorMessage(new Error('boom'))).toBe("Une erreur inattendue s'est produite.");
    expect(getErrorMessage('boom')).toBe("Une erreur inattendue s'est produite.");
  });
});
