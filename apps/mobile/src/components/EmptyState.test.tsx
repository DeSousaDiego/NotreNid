import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('affiche le titre et le message', async () => {
    const view = await renderWithTheme(
      <EmptyState title="Votre nid est encore vide." message="Ajoutez votre premier trésor." />,
    );

    expect(view.getByText('Votre nid est encore vide.')).toBeTruthy();
    expect(view.getByText('Ajoutez votre premier trésor.')).toBeTruthy();
  });

  it('n’affiche pas de bouton d’action si aucun gestionnaire n’est fourni', async () => {
    const view = await renderWithTheme(<EmptyState title="Aucun résultat" />);

    expect(view.queryByRole('button')).toBeNull();
  });

  it('affiche et déclenche le bouton d’action lorsqu’il est fourni', async () => {
    const onAction = jest.fn();
    const view = await renderWithTheme(
      <EmptyState title="Aucun résultat" actionLabel="Réessayer" onAction={onAction} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Réessayer' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
