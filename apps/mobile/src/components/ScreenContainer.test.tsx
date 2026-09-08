import { Platform } from 'react-native';

import { resolveKeyboardAvoidingBehavior } from './ScreenContainer';

describe('resolveKeyboardAvoidingBehavior', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('sur iOS, retourne toujours "padding", avec ou sans androidKeyboardBehavior', () => {
    Platform.OS = 'ios';

    expect(resolveKeyboardAvoidingBehavior(undefined)).toBe('padding');
    expect(resolveKeyboardAvoidingBehavior('height')).toBe('padding');
  });

  it('sur Android, ne retourne rien par défaut (comportement historique préservé)', () => {
    Platform.OS = 'android';

    expect(resolveKeyboardAvoidingBehavior(undefined)).toBeUndefined();
  });

  it('sur Android, retourne la valeur fournie quand elle est explicitement activée', () => {
    Platform.OS = 'android';

    expect(resolveKeyboardAvoidingBehavior('height')).toBe('height');
    expect(resolveKeyboardAvoidingBehavior('padding')).toBe('padding');
  });
});
