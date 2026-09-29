import { act, fireEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import { Platform, type TextInput } from 'react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { TextField } from './TextField';

/**
 * Structure uniquement : Jest ne reproduit pas la gestuelle native Android
 * (`requestDisallowInterceptTouchEvent` de `ReactEditText`). La validation réelle du
 * glissement reste un test manuel sur téléphone.
 */
describe('TextField — allowScrollFromField', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  });

  function useAndroid() {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  }

  it('Android: unfocused field lets touches land on a shield (input pointerEvents none), a tap focuses it', async () => {
    useAndroid();
    const ref = createRef<TextInput>();
    const view = await renderWithTheme(<TextField ref={ref} label="Titre" allowScrollFromField />);
    const input = view.getByLabelText('Titre');
    const focusSpy = jest.spyOn(ref.current!, 'focus');

    expect(input.props.pointerEvents).toBe('none');
    const shield = view.getByTestId('text-field-touch-shield');
    expect(shield.props.accessible).toBe(false);

    await fireEvent.press(shield);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('Android: once focused, the field is fully native again (cursor, selection) — same tree, shield disabled', async () => {
    useAndroid();
    const view = await renderWithTheme(<TextField label="Titre" allowScrollFromField />);

    await act(async () => {
      view.getByLabelText('Titre').props.onFocus?.({});
    });

    expect(view.getByLabelText('Titre').props.pointerEvents).toBe('auto');
    // Toujours présent (jamais retiré au focus : remonter le TextInput lui ferait perdre
    // le focus), simplement désactivé.
    expect(view.getByTestId('text-field-touch-shield')).toBeTruthy();
  });

  it('is opt-in: no shield without the prop, even on Android', async () => {
    useAndroid();
    const view = await renderWithTheme(<TextField label="Email" />);

    expect(view.queryByTestId('text-field-touch-shield')).toBeNull();
    expect(view.getByLabelText('Email').props.pointerEvents).toBe('auto');
  });

  it('does nothing on iOS, where the native field does not block the parent scroll', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    const view = await renderWithTheme(<TextField label="Titre" allowScrollFromField />);

    expect(view.queryByTestId('text-field-touch-shield')).toBeNull();
    expect(view.getByLabelText('Titre').props.pointerEvents).toBe('auto');
  });
});
