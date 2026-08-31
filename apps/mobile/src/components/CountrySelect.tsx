import { ISO_COUNTRIES, getCountryName } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { useTheme } from '../theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { SearchField } from './SearchField';

export interface CountrySelectProps {
  label: string;
  /** Codes ISO 3166-1 alpha-2 sélectionnés (plusieurs valeurs possibles, ex. coproduction). */
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
}

// Plage Unicode des diacritiques combinants (0x0300-0x036f), construite via code points
// plutôt qu'un littéral regex : évite d'embarquer des caractères combinants invisibles
// dans le fichier source.
const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS_PATTERN, '');
}

/**
 * Sélecteur de pays à choix multiples avec recherche, ouvrant un `BottomSheet`
 * listant les 249 codes ISO 3166-1 (docs/NOTRE_NID_PRD.md — Bloc 1, point 1C).
 * Les valeurs stockées sont toujours des codes ISO ; seul l'affichage est en français.
 */
export function CountrySelect({
  label,
  value,
  onChange,
  placeholder = 'Aucun pays renseigné',
}: CountrySelectProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel =
    value.length === 0 ? placeholder : value.map((code) => getCountryName(code) ?? code).join(', ');

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    if (!normalizedQuery) return ISO_COUNTRIES;
    return ISO_COUNTRIES.filter(
      (option) =>
        normalize(option.name).includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [query]);

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

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
        <AppText
          variant="body"
          color={value.length > 0 ? 'text' : 'textMuted'}
          numberOfLines={1}
          style={{ flex: 1, marginRight: theme.spacing.sm }}
        >
          {selectedLabel}
        </AppText>
        <Ionicons name="chevron-down" size={theme.iconSizes.sm} color={theme.colors.textMuted} />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => {
          setQuery('');
          setOpen(false);
        }}
        title={label}
        scrollable={false}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            onClear={() => setQuery('')}
            placeholder="Rechercher un pays…"
            accessibilityLabel="Rechercher un pays"
          />
          {value.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer tous les pays sélectionnés"
              onPress={() => onChange([])}
              style={{ alignSelf: 'flex-start' }}
              hitSlop={8}
            >
              <AppText variant="label" color="danger">
                Tout effacer
              </AppText>
            </Pressable>
          ) : null}
          <FlatList
            data={filteredOptions}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 320 }}
            ListEmptyComponent={
              <AppText
                variant="body"
                color="textMuted"
                style={{ paddingVertical: theme.spacing.md, textAlign: 'center' }}
              >
                Aucun pays ne correspond à cette recherche.
              </AppText>
            }
            renderItem={({ item }) => {
              const isSelected = value.includes(item.code);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={item.name}
                  onPress={() => toggle(item.code)}
                  style={{
                    minHeight: 44,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <AppText variant="body" color={isSelected ? 'primary' : 'text'}>
                    {item.name}
                  </AppText>
                  {isSelected ? (
                    <Ionicons
                      name="checkmark"
                      size={theme.iconSizes.md}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}
