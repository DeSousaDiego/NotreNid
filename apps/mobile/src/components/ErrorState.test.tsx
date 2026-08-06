import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('affiche le message d’erreur et permet de réessayer', async () => {
    const onRetry = jest.fn();
    const view = await renderWithTheme(
      <ErrorState
        message="Impossible de joindre le service. Vérifiez votre connexion et réessayez."
        onRetry={onRetry}
      />,
    );

    expect(
      view.getByText('Impossible de joindre le service. Vérifiez votre connexion et réessayez.'),
    ).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('n’affiche pas de bouton lorsqu’aucun onRetry n’est fourni', async () => {
    const view = await renderWithTheme(<ErrorState message="Erreur inconnue" />);

    expect(view.queryByRole('button')).toBeNull();
  });
});
