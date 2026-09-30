import { act, fireEvent } from '@testing-library/react-native';
import { createRef } from 'react';
import { Platform, type TextInput } from 'react-native';

import { renderWithTheme } from '../test-utils/renderWithTheme';

import { TextField } from './TextField';

/**
 * Structure uniquement : Jest ne reproduit pas la gestuelle native Android
 * (`requestDisallowInterceptTouchEvent` de `ReactEditText`, interception par
 * `ReactViewGroup` en `box-only`). La validation réelle du glissement reste un test
 * manuel sur téléphone.
 */
describe('TextField — allowScrollFromField', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  });

  function useAndroid() {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
  }

  it('Android: unfocused, the shield is box-only (the native EditText never gets the touch), a tap focuses it', async () => {
    useAndroid();
    const ref = createRef<TextInput>();
    const view = await renderWithTheme(<TextField ref={ref} label="Titre" allowScrollFromField />);
    const focusSpy = jest.spyOn(ref.current!, 'focus');

    const shield = view.getByTestId('text-field-touch-shield');
    // `box-only` sur l'enveloppe (et non `none` sur le TextInput, que `ReactEditText`
    // ignore nativement) : c'est ce qui prive réellement le champ du toucher.
    expect(shield.props.pointerEvents).toBe('box-only');
    expect(view.getByLabelText('Titre').props.pointerEvents).toBeUndefined();
    expect(shield.props.accessible).toBe(false);

    await fireEvent.press(shield);
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('Android: same shield without placeholder, numeric or multiline (no prop overrides it)', async () => {
    useAndroid();
    const view = await renderWithTheme(
      <>
        <TextField label="Année" keyboardType="numeric" allowScrollFromField />
        <TextField label="Notes" multiline placeholder="…" allowScrollFromField />
      </>,
    );

    const shields = view.getAllByTestId('text-field-touch-shield');
    expect(shields).toHaveLength(2);
    for (const shield of shields) expect(shield.props.pointerEvents).toBe('box-only');
  });

  it('Android: once focused, the field is fully native again (cursor, selection) — same tree, shield auto', async () => {
    useAndroid();
    const view = await renderWithTheme(<TextField label="Titre" allowScrollFromField />);

    await act(async () => {
      view.getByLabelText('Titre').props.onFocus?.({});
    });

    // Toujours présent (jamais retiré au focus : remonter le TextInput lui ferait perdre
    // le focus), simplement laissé passer.
    expect(view.getByTestId('text-field-touch-shield').props.pointerEvents).toBe('auto');

    await act(async () => {
      view.getByLabelText('Titre').props.onBlur?.({});
    });
    expect(view.getByTestId('text-field-touch-shield').props.pointerEvents).toBe('box-only');
  });

  it('Android: a non-editable field keeps its native behaviour (shield inactive)', async () => {
    useAndroid();
    const view = await renderWithTheme(
      <TextField label="Titre" editable={false} allowScrollFromField />,
    );

    expect(view.getByTestId('text-field-touch-shield').props.pointerEvents).toBe('auto');
  });

  it('is opt-in: no shield without the prop, even on Android', async () => {
    useAndroid();
    const view = await renderWithTheme(<TextField label="Email" />);

    expect(view.queryByTestId('text-field-touch-shield')).toBeNull();
  });

  it('does nothing on iOS, where the native field does not block the parent scroll', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' });
    const view = await renderWithTheme(<TextField label="Titre" allowScrollFromField />);

    expect(view.queryByTestId('text-field-touch-shield')).toBeNull();
  });
});
