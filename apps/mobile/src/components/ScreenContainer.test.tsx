import { Platform } from 'react-native';

import {
  computeScrollIntoViewDelta,
  isKeyboardAwareLayout,
  resolveKeyboardAvoidingBehavior,
} from './ScreenContainer';

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

describe('isKeyboardAwareLayout', () => {
  it('est faux sans scroll, même avec androidKeyboardBehavior fourni', () => {
    expect(isKeyboardAwareLayout(false, 'height')).toBe(false);
  });

  it('est faux avec scroll mais sans androidKeyboardBehavior — écrans non retestés (ex. connexion, filtres)', () => {
    expect(isKeyboardAwareLayout(true, undefined)).toBe(false);
  });

  it('est vrai uniquement quand scroll et androidKeyboardBehavior sont tous deux fournis', () => {
    expect(isKeyboardAwareLayout(true, 'height')).toBe(true);
    expect(isKeyboardAwareLayout(true, 'padding')).toBe(true);
  });
});

describe('computeScrollIntoViewDelta', () => {
  it('calcule le delta exact nécessaire quand le bas du champ dépasse le bas visible', () => {
    // Champ dont le bas est à 700, marge de confort 20, bas visible (haut du footer) à 650 :
    // il faut libérer exactement 700 + 20 - 650 = 70px, ni plus ni moins.
    expect(computeScrollIntoViewDelta(700, 650, 20)).toBe(70);
  });

  it('ne scrolle pas si le champ est déjà entièrement visible avec sa marge', () => {
    // Bas du champ à 500, marge 20 -> 520, largement au-dessus du bas visible à 650.
    expect(computeScrollIntoViewDelta(500, 650, 20)).toBe(0);
  });

  it('ne scrolle pas quand le champ affleure exactement la marge (limite, pas de sur-correction)', () => {
    // 630 + 20 === 650 : déjà exactement à la marge voulue, aucun scroll requis.
    expect(computeScrollIntoViewDelta(630, 650, 20)).toBe(0);
  });

  it('le delta reste limité au strict nécessaire, jamais à une hauteur de clavier entière', () => {
    // Un dépassement de 5px ne doit produire qu'un delta de 5px (+ marge), pas une
    // grosse valeur forfaitaire du type "hauteur du clavier" (ex. 300px).
    const delta = computeScrollIntoViewDelta(655, 650, 20);
    expect(delta).toBe(25);
    expect(delta).toBeLessThan(300);
  });

  it('une marge de sécurité plus grande augmente le delta d’autant, au-dessus du footer', () => {
    const smallMargin = computeScrollIntoViewDelta(660, 650, 16);
    const largeMargin = computeScrollIntoViewDelta(660, 650, 24);
    expect(smallMargin).toBe(26);
    expect(largeMargin).toBe(34);
    expect(largeMargin - smallMargin).toBe(8);
  });
});
