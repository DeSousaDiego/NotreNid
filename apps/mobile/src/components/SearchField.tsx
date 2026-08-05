import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';

import { useTheme } from '../theme';

export interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  accessibilityLabel?: string;
}

/** Champ de recherche avec icône et bouton d'effacement. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Rechercher…',
  onClear,
  accessibilityLabel = 'Rechercher',
}: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radii.full,
        paddingHorizontal: theme.spacing.md,
        backgroundColor: theme.colors.surface,
        gap: theme.spacing.sm,
      }}
    >
      <Ionicons name="search-outline" size={theme.iconSizes.md} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{
          flex: 1,
          fontFamily: theme.fonts.regular,
          fontSize: theme.typography.body.fontSize,
          color: theme.colors.text,
        }}
      />
      {value.length > 0 && onClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
          onPress={onClear}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={theme.iconSizes.md} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
