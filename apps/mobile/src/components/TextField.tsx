import { forwardRef, useMemo, useRef, useState, type Ref, type RefCallback } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';

import { useScrollFocusedFieldIntoView } from './ScreenContainer';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  helperText?: string;
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
  { label, errorMessage, helperText, editable = true, style, onFocus, onBlur, ...inputProps },
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

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  helper: { marginTop: 6 },
});
