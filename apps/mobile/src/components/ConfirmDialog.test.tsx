import { fireEvent } from '@testing-library/react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('affiche le titre et le message, et appelle onConfirm/onCancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const view = await renderWithTheme(
      <ConfirmDialog
        visible
        title="Archiver cet objet ?"
        message="Il pourra être restauré plus tard."
        confirmLabel="Archiver"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(view.getByText('Archiver cet objet ?')).toBeTruthy();
    expect(view.getByText('Il pourra être restauré plus tard.')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Archiver' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await fireEvent.press(view.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  }, 15000);

  it('ne rend rien de visible quand visible=false', async () => {
    const view = await renderWithTheme(
      <ConfirmDialog
        visible={false}
        title="Archiver cet objet ?"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(view.queryByText('Archiver cet objet ?')).toBeNull();
  });

  it('désactive les boutons pendant le chargement', async () => {
    const view = await renderWithTheme(
      <ConfirmDialog
        visible
        title="Archiver cet objet ?"
        confirmLabel="Archiver"
        loading
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(view.getByRole('button', { name: 'Annuler' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });
});
