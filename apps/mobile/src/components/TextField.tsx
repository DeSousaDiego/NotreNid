import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  errorMessage?: string;
  helperText?: string;
}

/** Champ de texte standard : label, aide, erreur, états focus/erreur/désactivé. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, errorMessage, helperText, editable = true, style, onFocus, onBlur, ...inputProps },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorMessage);

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
        ref={ref}
        editable={editable}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
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
