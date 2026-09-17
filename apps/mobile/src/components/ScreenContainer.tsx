import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

export interface ScreenContainerProps {
  children: ReactNode;
  edges?: Edge[];
  /** Enveloppe le contenu dans un ScrollView + évitement clavier (formulaires). */
  scroll?: boolean;
  /**
   * Comportement de `KeyboardAvoidingView` sur Android — aucun par défaut (comportement
   * historique inchangé pour ne pas affecter les écrans qui ne l'activent pas). iOS utilise
   * toujours `"padding"`, indépendamment de cette prop.
   *
   * Sur Android récent (edge-to-edge obligatoire depuis Expo SDK 54), l'app dessine derrière
   * la barre de navigation et le clavier : `windowSoftInputMode="adjustResize"` ne redimensionne
   * plus réellement la fenêtre, donc sans ce comportement explicite rien ne réserve de place
   * pour le clavier et le champ actif peut se retrouver masqué. `"height"` correspond à
   * l'exemple canonique de la documentation React Native pour Android.
   */
  androidKeyboardBehavior?: 'height' | 'padding';
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /**
   * Zone fixe sous le contenu, hors ScrollView — pour une action qui doit rester
   * visible en permanence sans dépendre du scroll (ex. "Appliquer les filtres").
   * Rendu comme un frère du ScrollView, pas en overlay : le layout flex réserve
   * déjà sa hauteur, donc `contentStyle` n'a besoin que d'une petite marge de fin
   * de liste (`spacing.sm`/`md`) — pas de compenser la hauteur du footer, qui
   * créerait un vide en bas une fois le scroll arrivé au bout. Le fournisseur
   * gère lui-même son padding bas (`useSafeAreaInsets().bottom`).
   */
  footer?: ReactNode;
}

/**
 * iOS utilise toujours `"padding"`. Android n'a de comportement que si l'écran
 * l'active explicitement via `androidKeyboardBehavior` (voir sa documentation
 * ci-dessus) — extrait en fonction pure pour rester testable sans dépendre du
 * rendu (le renderer de test n'expose que les éléments hôtes, pas les props
 * internes d'un composant composite comme `KeyboardAvoidingView`).
 */
export function resolveKeyboardAvoidingBehavior(
  androidKeyboardBehavior: ScreenContainerProps['androidKeyboardBehavior'],
): 'padding' | 'height' | undefined {
  return Platform.OS === 'ios' ? 'padding' : androidKeyboardBehavior;
}

/**
 * Un écran n'active la mesure de décalage clavier et la marge de défilement
 * dynamique (voir plus bas) que s'il a explicitement demandé une gestion
 * soignée du clavier via `androidKeyboardBehavior` — aujourd'hui uniquement
 * `ItemFormScreen` (création et édition). Volontairement pas appliqué à tous
 * les écrans défilants existants (connexion, filtres…) : ils n'ont pas été
 * retestés pour ce comportement et n'ont signalé aucun problème. Extrait en
 * fonction pure pour rester testable — même contrainte que
 * `resolveKeyboardAvoidingBehavior` ci-dessus.
 */
export function isKeyboardAwareLayout(
  scroll: boolean,
  androidKeyboardBehavior: ScreenContainerProps['androidKeyboardBehavior'],
): boolean {
  return scroll && androidKeyboardBehavior !== undefined;
}

/** Position mesurable d'un nœud natif — `TextInput`, `View`, `ScrollView`… tout
 * composant hôte expose `measureInWindow` (coordonnées absolues à l'écran). */
export interface MeasurableNode {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

export interface ScrollFocusedFieldIntoViewOptions {
  /** Marge de confort au-dessus du footer/clavier, en dp. Par défaut `theme.spacing.xl` (24). */
  margin?: number;
}

export type ScrollFocusedFieldIntoView = (
  node: MeasurableNode,
  options?: ScrollFocusedFieldIntoViewOptions,
) => void;

/**
 * Fournie par `ScreenContainer` (uniquement pour les écrans "keyboard aware",
 * voir `isKeyboardAwareLayout`) et consommée par `TextField` : sur focus, un
 * champ texte demande à être scrollé au-dessus du footer/clavier si besoin.
 * `null` en dehors d'un tel `ScreenContainer` (ou si aucun Provider n'englobe
 * le champ) — `TextField` n'a alors simplement aucun effet à déclencher.
 */
const ScrollIntoViewContext = createContext<ScrollFocusedFieldIntoView | null>(null);

export function useScrollFocusedFieldIntoView(): ScrollFocusedFieldIntoView | null {
  return useContext(ScrollIntoViewContext);
}

/**
 * Delta de défilement nécessaire pour qu'un champ dont le bas se trouve à
 * `fieldBottom` (coordonnées absolues à l'écran) soit visible avec une marge
 * `margin` au-dessus de `viewportBottom` (bas de la zone visible défilable —
 * dans `ScreenContainer`, ceci correspond au haut du footer, puisque celui-ci
 * est un frère du `ScrollView`, pas une superposition). Retourne `0` si le
 * champ est déjà suffisamment visible : jamais de scroll inutile, jamais plus
 * que le strict nécessaire (contrairement à une marge fixe égale à la hauteur
 * du clavier, ajoutée à demeure au contenu). Extrait en fonction pure pour
 * rester testable — la mesure réelle (`measureInWindow`) ne l'est pas.
 */
export function computeScrollIntoViewDelta(
  fieldBottom: number,
  viewportBottom: number,
  margin: number,
): number {
  return Math.max(fieldBottom + margin - viewportBottom, 0);
}

/** Conteneur d'écran standard : fond crème, safe area, padding cohérent. */
export function ScreenContainer({
  children,
  edges = ['top', 'left', 'right'],
  scroll = false,
  androidKeyboardBehavior,
  style,
  contentStyle,
  footer,
}: ScreenContainerProps) {
  const theme = useTheme();
  const keyboardAware = isKeyboardAwareLayout(scroll, androidKeyboardBehavior);

  // `KeyboardAvoidingView` calcule son décalage à partir de la position de son
  // propre `onLayout`, laquelle est relative à son parent direct — pas à l'écran
  // physique. Sous un header natif (Stack), cette vue ne commence donc pas à
  // y=0 réel : sans correction, `KeyboardAvoidingView` sous-estime de la hauteur
  // du header l'espace occupé par le clavier, et ne libère pas assez de place
  // (bouton du footer coupé, champ focus insuffisamment remonté — bug constaté
  // en test manuel Android). `measureInWindow` donne la position absolue réelle
  // de ce wrapper (header + status bar déjà inclus, sans avoir à connaître leur
  // hauteur exacte) ; on la fournit à `keyboardVerticalOffset`, l'usage prévu
  // par React Native pour exactement ce cas ("distance between the top of the
  // user's screen and the react native view").
  const keyboardOffsetRef = useRef<View>(null);
  const [keyboardVerticalOffset, setKeyboardVerticalOffset] = useState(0);
  const measureKeyboardOffset = useCallback(() => {
    keyboardOffsetRef.current?.measureInWindow((_x, y) => setKeyboardVerticalOffset(y));
  }, []);

  // Scroll ciblé sur le champ focus (remplace une ancienne marge fixe égale à
  // la hauteur du clavier, ajoutée à demeure au contenu — trop grande et sans
  // rapport avec le champ réellement concerné). `scrollOffsetRef` évite un
  // rendu à chaque frame de scroll : seule la lecture au moment du calcul
  // compte. `pendingFieldRef` mémorise le dernier champ focus pour retenter le
  // calcul une fois le `ScrollView` réellement redimensionné (voir `onLayout`
  // plus bas) : au moment du focus, `KeyboardAvoidingView` peut ne pas avoir
  // fini d'appliquer son `LayoutAnimation` — `measureInWindow` sur le
  // `ScrollView` refléterait alors sa taille *avant* rétrécissement (mesure
  // périmée constatée en test manuel : le scroll se déclenchait bien, mais
  // sans jamais gagner davantage qu'avant ce correctif). D'où une tentative
  // immédiate (couvre le cas où le clavier est déjà ouvert et stable) et une
  // tentative différée déclenchée par le premier `onLayout` du `ScrollView`
  // qui suit (couvre l'ouverture en cours) — un `onLayout` ne se déclenche que
  // lorsque la taille a réellement changé, donc uniquement quand c'est
  // pertinent, sans minuterie devinée.
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const pendingFieldRef = useRef<{ node: MeasurableNode; margin: number } | null>(null);

  // Marge de confort au-dessus du footer/clavier une fois le champ scrollé.
  // Sert aussi de socle à la marge de fin de contenu ci-dessous : sans elle,
  // un champ tout en bas (ex. Description, dernier champ de l'étape 1) ne
  // pourrait pas être scrollé jusqu'à cette marge — `scrollTo` serait plafonné
  // par `contentSize`, faute de place à parcourir sous le champ.
  const scrollIntoViewMargin = theme.spacing.xl;

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const performScrollIntoView = useCallback((node: MeasurableNode, margin: number) => {
    const scrollView = scrollViewRef.current;
    if (!scrollView) return;
    // `ScrollView`'s type declarations n'exposent pas `measureInWindow`, bien que
    // l'instance native réelle le fournisse (voir `ScrollView.js`, `_scrollView` :
    // le ref rendu à l'appelant est `Object.assign(nativeInstance, {...})`, donc
    // l'instance native elle-même, avec toutes ses méthodes hôtes).
    const measurableScrollView = scrollView as unknown as MeasurableNode;
    node.measureInWindow((_fieldX, fieldY, _fieldWidth, fieldHeight) => {
      measurableScrollView.measureInWindow((_svX, svY, _svWidth, svHeight) => {
        const delta = computeScrollIntoViewDelta(fieldY + fieldHeight, svY + svHeight, margin);
        if (delta > 0) {
          scrollView.scrollTo({ y: scrollOffsetRef.current + delta, animated: true });
        }
      });
    });
  }, []);

  const scrollFocusedFieldIntoView = useCallback<ScrollFocusedFieldIntoView>(
    (node, options) => {
      const margin = options?.margin ?? scrollIntoViewMargin;
      pendingFieldRef.current = { node, margin };
      performScrollIntoView(node, margin);
    },
    [performScrollIntoView, scrollIntoViewMargin],
  );

  const handleScrollViewLayout = useCallback(() => {
    const pending = pendingFieldRef.current;
    if (pending) performScrollIntoView(pending.node, pending.margin);
  }, [performScrollIntoView]);

  const basePadding = theme.spacing.lg;
  const scrollableContent = (
    <ScrollView
      ref={scrollViewRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { padding: basePadding },
        // Marge de fin de contenu permanente (pas une hauteur de clavier entière)
        // pour qu'un champ tout en bas puisse effectivement être scrollé jusqu'à
        // `scrollIntoViewMargin` au-dessus du footer — voir le commentaire plus haut.
        keyboardAware ? { paddingBottom: basePadding + scrollIntoViewMargin } : null,
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      onScroll={keyboardAware ? handleScroll : undefined}
      scrollEventThrottle={keyboardAware ? 16 : undefined}
      onLayout={keyboardAware ? handleScrollViewLayout : undefined}
    >
      {children}
    </ScrollView>
  );
  const content = scroll ? (
    keyboardAware ? (
      <ScrollIntoViewContext.Provider value={scrollFocusedFieldIntoView}>
        {scrollableContent}
      </ScrollIntoViewContext.Provider>
    ) : (
      scrollableContent
    )
  ) : (
    <View style={[styles.content, { padding: basePadding }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
    >
      <View
        ref={keyboardOffsetRef}
        onLayout={keyboardAware ? measureKeyboardOffset : undefined}
        style={styles.flex}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={resolveKeyboardAvoidingBehavior(androidKeyboardBehavior)}
          keyboardVerticalOffset={keyboardAware ? keyboardVerticalOffset : 0}
        >
          {content}
          {footer}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
