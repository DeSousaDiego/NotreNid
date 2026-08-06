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

  it('retourne un message générique pour une erreur inconnue', () => {
    expect(getErrorMessage(new Error('boom'))).toBe("Une erreur inattendue s'est produite.");
    expect(getErrorMessage('boom')).toBe("Une erreur inattendue s'est produite.");
  });
});
