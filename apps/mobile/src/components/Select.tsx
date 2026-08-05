import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T | undefined) => void;
  placeholder?: string;
  allowClear?: boolean;
}

/** Sélecteur à choix unique, ouvrant un BottomSheet listant les options. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Tous',
  allowClear = true,
}: SelectProps<T>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <View>
      <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${selectedLabel}`}
        onPress={() => setOpen(true)}
        style={{
          minHeight: 44,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.sm,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: theme.colors.surface,
        }}
      >
        <AppText variant="body" color={value ? 'text' : 'textMuted'}>
          {selectedLabel}
        </AppText>
        <Ionicons name="chevron-down" size={theme.iconSizes.sm} color={theme.colors.textMuted} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <FlatList
          data={allowClear ? [{ value: undefined, label: placeholder }, ...options] : options}
          keyExtractor={(item) => item.value ?? '__clear__'}
          renderItem={({ item }) => {
            const isSelected = item.value === value;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => {
                  onChange(item.value as T | undefined);
                  setOpen(false);
                }}
                style={{
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <AppText variant="body" color={isSelected ? 'primary' : 'text'}>
                  {item.label}
                </AppText>
                {isSelected ? (
                  <Ionicons name="checkmark" size={theme.iconSizes.md} color={theme.colors.primary} />
                ) : null}
              </Pressable>
            );
          }}
        />
      </BottomSheet>
    </View>
  );
}
