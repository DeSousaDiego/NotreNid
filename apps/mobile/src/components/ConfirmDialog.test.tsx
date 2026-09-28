import { fireEvent } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

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

describe('ConfirmDialog — mise en page des actions (hotfix)', () => {
  function actionsOf(view: Awaited<ReturnType<typeof renderWithTheme>>) {
    const container = view.getByTestId('confirm-dialog-actions');
    return {
      containerStyle: StyleSheet.flatten(container.props.style) as ViewStyle,
      buttonStyle: (name: string) =>
        StyleSheet.flatten(view.getByRole('button', { name }).props.style) as ViewStyle,
    };
  }

  it('stacked: long labels are stacked full width, confirm first — never side by side', async () => {
    const view = await renderWithTheme(
      <ConfirmDialog
        visible
        title="Quitter sans enregistrer ?"
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Continuer la modification"
        actionsLayout="stacked"
        destructive
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const { containerStyle, buttonStyle } = actionsOf(view);
    expect(containerStyle.flexDirection).toBe('column');
    for (const name of ['Quitter sans enregistrer', 'Continuer la modification']) {
      const style = buttonStyle(name);
      expect(style.alignSelf).toBe('stretch');
      expect(style.width).toBeUndefined();
      expect(style.minWidth).toBeUndefined();
    }
    expect(view.getByText('Quitter sans enregistrer')).toBeTruthy();
    expect(view.getByText('Continuer la modification')).toBeTruthy();

    // Ordre : confirmation d'abord, annulation ensuite.
    const labels = view.getAllByText(/Quitter sans enregistrer$|Continuer la modification/);
    expect(labels.map((node) => node.props.children)).toEqual([
      'Quitter sans enregistrer',
      'Continuer la modification',
    ]);
  });

  it('row (default): both buttons may shrink and have no rigid width, so neither can overflow the dialog', async () => {
    const view = await renderWithTheme(
      <ConfirmDialog
        visible
        title="Archiver cet objet ?"
        confirmLabel="Archiver"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    const { containerStyle, buttonStyle } = actionsOf(view);
    expect(containerStyle.flexDirection).toBe('row');
    for (const name of ['Annuler', 'Archiver']) {
      const style = buttonStyle(name);
      expect(style.flexShrink).toBe(1);
      expect(style.width).toBeUndefined();
      expect(style.minWidth).toBeUndefined();
    }
  });
});
