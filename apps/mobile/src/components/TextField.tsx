import {
  forwardRef,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefCallback,
} from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '../theme';

import { useScrollFocusedFieldIntoView } from './ScreenContainer';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  helperText?: string;
  /**
   * Android uniquement : laisse le `ScrollView` parent récupérer un glissement vertical
   * COMMENCÉ sur ce champ tant qu'il n'a pas le focus. Le `EditText` natif interdit
   * au parent d'intercepter le geste dès le toucher (`requestDisallowInterceptTouchEvent`,
   * voir `ReactEditText.onTouchEvent`) et ne le rend que s'il ne peut défiler dans
   * AUCUNE direction — un texte qui déborde, ou quelques pixels d'écart entre la hauteur
   * mesurée et celle réellement dessinée, suffisent à bloquer la page (cas typique :
   * champ vide SANS placeholder, mesuré par Fabric sur une chaîne vide). Hors focus,
   * l'enveloppe `Pressable` passe en `pointerEvents="box-only"` : `ReactViewGroup`
   * intercepte alors le toucher AVANT le `EditText`, qui ne le reçoit jamais (tap
   * court = focus via `onPress`). Un `pointerEvents` posé sur le `TextInput` lui-même
   * n'aurait aucun effet natif : `ReactEditText` ne l'implémente pas. Une fois
   * focalisé, le champ retrouve tout son comportement natif (curseur, sélection,
   * défilement interne). Opt-in : réservé aux formulaires longs (Ajout/Édition).
   */
  allowScrollFromField?: boolean;
}

/** Combine une ref externe (transmise par l'appelant, ex. RHF) et une ref
 * interne (nécessaire ici pour `measureInWindow` au focus) sur le même nœud —
 * aucune des deux n'exclut l'autre. */
function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

/** Champ de texte standard : label, aide, erreur, états focus/erreur/désactivé. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    errorMessage,
    helperText,
    editable = true,
    allowScrollFromField = false,
    style,
    onFocus,
    onBlur,
    ...inputProps
  },
  forwardedRef,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);
  const inputRef = useRef<TextInput>(null);
  // `null` hors d'un `ScreenContainer` "keyboard aware" (voir ScreenContainer) —
  // seul un champ texte ouvre le clavier, donc seul lui a besoin de ce
  // comportement (Select, StarRating, Chip… n'appellent pas ce hook).
  const scrollFocusedFieldIntoView = useScrollFocusedFieldIntoView();
  // Mémoïsé sur `forwardedRef` (stable dans tous les usages actuels) : sans
  // cela, une nouvelle fonction de ref à chaque rendu réassignerait le nœud
  // natif (`null` puis reposé) à chaque frappe, `inputRef` étant lui-même
  // stable via `useRef`.
  const setInputRef = useMemo(() => mergeRefs<TextInput>(forwardedRef, inputRef), [forwardedRef]);

  // Structure stable : l'enveloppe existe toujours quand l'option est active (jamais
  // ajoutée/retirée au focus, ce qui remonterait le `TextInput` et lui ferait perdre le
  // focus) — seuls son `pointerEvents` et son `disabled` basculent.
  const touchShield = allowScrollFromField && Platform.OS === 'android';
  const shieldActive = touchShield && !focused && editable;

  const borderColor = hasError
    ? theme.colors.danger
    : focused
      ? theme.colors.primary
      : theme.colors.border;

  return (
    <View>
      <AppText variant="label" color="textMuted" style={styles.label}>
        {label}
      </AppText>
      <FieldTouchShield
        enabled={touchShield}
        active={shieldActive}
        onPress={() => inputRef.current?.focus()}
      >
        <TextInput
          ref={setInputRef}
          editable={editable}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            if (inputRef.current) scrollFocusedFieldIntoView?.(inputRef.current);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              minHeight: 44,
              borderWidth: 1,
              borderColor,
              borderRadius: theme.radii.sm,
              paddingHorizontal: theme.spacing.md,
              fontFamily: theme.fonts.regular,
              fontSize: theme.typography.body.fontSize,
              color: theme.colors.text,
              backgroundColor: editable ? theme.colors.surface : theme.colors.border,
            },
            style,
          ]}
          {...inputProps}
        />
      </FieldTouchShield>
      {hasError ? (
        <AppText variant="helper" color="danger" style={styles.helper}>
          {errorMessage}
        </AppText>
      ) : helperText ? (
        <AppText variant="helper" color="textMuted" style={styles.helper}>
          {helperText}
        </AppText>
      ) : null}
    </View>
  );
});

/** Enveloppe tactile du champ (voir `allowScrollFromField`) — transparente sinon. */
function FieldTouchShield({
  enabled,
  active,
  onPress,
  children,
}: {
  enabled: boolean;
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <Pressable
      testID="text-field-touch-shield"
      // Aucun nœud d'accessibilité supplémentaire : TalkBack active directement le champ.
      accessible={false}
      importantForAccessibility="no"
      disabled={!active}
      // Hors focus : le toucher s'arrête sur cette vue native (jamais transmis au
      // `EditText`), le `ScrollView` parent peut donc l'intercepter.
      pointerEvents={active ? 'box-only' : 'auto'}
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  helper: { marginTop: 6 },
});
