import type { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, CHIP_HIT_SLOP, ScreenContainer } from '../../../components';
import { COLLECTION_SORT_PRESETS, isSortPresetSelected } from '../../../constants/collectionSort';
import { CONDITION_OPTIONS } from '../../../constants/condition';
import { useCategories } from '../../../hooks/useCategories';
import { useMembers } from '../../../hooks/useMembers';
import {
  DEFAULT_COLLECTION_FILTERS,
  useCollectionFilters,
  type CollectionFiltersState,
} from '../../../providers/CollectionFiltersProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { FormSection } from '../../../screens/item-form/FormSection';
import { useTheme } from '../../../theme';

/** Titre léger des formulaires (repère terracotta + libellé vert forêt) et chips
 * dessous. L'écart entre rangées (`2 × CHIP_HIT_SLOP`) garde des zones tactiles de
 * 44 pt jointives, sans chevauchement d'une rangée sur l'autre. */
function FilterSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <FormSection icon={icon} title={title}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          columnGap: theme.spacing.xs,
          rowGap: 2 * CHIP_HIT_SLOP,
        }}
      >
        {children}
      </View>
    </FormSection>
  );
}

function isDefaultFilters(filters: CollectionFiltersState): boolean {
  return (Object.keys(DEFAULT_COLLECTION_FILTERS) as (keyof CollectionFiltersState)[]).every(
    (key) => filters[key] === DEFAULT_COLLECTION_FILTERS[key],
  );
}

/**
 * Écran dédié plutôt qu'une bottom sheet (docs/PHASE_STATUS.md) : l'ancienne
 * implémentation empilait un `Select` — lui-même une bottom sheet — par-dessus
 * la sheet de filtres déjà ouverte, ce qui devenait exigu sur petit écran.
 * Comportement "brouillon + Appliquer" : les changements ne sont commités dans
 * le filtre partagé qu'au tap sur le bouton, jamais en live pendant la sélection.
 * Route hors des onglets (Stack `(app)`, comme le Détail) : la tab bar n'y est pas
 * affichée, l'écran garde son en-tête avec retour.
 */
export default function FiltersScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { householdId } = useHousehold();
  const { filters, setFilters } = useCollectionFilters();
  const [draft, setDraft] = useState<CollectionFiltersState>(filters);

  const categoriesQuery = useCategories(householdId);
  const membersQuery = useMembers(householdId);
  const categories = categoriesQuery.data ?? [];
  const members = membersQuery.data ?? [];

  const handleApply = () => {
    setFilters(draft);
    router.back();
  };

  const handleReset = () => setDraft(DEFAULT_COLLECTION_FILTERS);

  return (
    <ScreenContainer
      scroll
      // Pas de bord `bottom` : le footer gère lui-même la zone système (plus de tab
      // bar sous cet écran), comme le footer d'Ajout/Modification.
      edges={['left', 'right']}
      contentStyle={{ paddingBottom: theme.spacing.lg }}
      footer={
        <View
          testID="filters-footer"
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.sm,
              paddingBottom: insets.bottom + theme.spacing.sm,
              backgroundColor: theme.colors.background,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            },
            theme.elevation.low,
          ]}
        >
          {/* Action secondaire : bouton discret de 44 pt, inactif quand il n'y a
              rien à réinitialiser ; « Appliquer » reste l'action principale. */}
          <Button
            label="Réinitialiser"
            variant="ghost"
            onPress={handleReset}
            disabled={isDefaultFilters(draft)}
          />
          <View style={{ flex: 1 }}>
            <Button label="Appliquer les filtres" onPress={handleApply} />
          </View>
        </View>
      }
    >
      <View style={{ gap: theme.spacing.lg }}>
        <FilterSection icon="albums-outline" title="Catégorie">
          <Chip
            label="Toutes"
            selected={draft.categoryId === undefined}
            onPress={() => setDraft((d) => ({ ...d, categoryId: undefined }))}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={draft.categoryId === category.id}
              onPress={() => setDraft((d) => ({ ...d, categoryId: category.id }))}
            />
          ))}
        </FilterSection>

        <FilterSection icon="people-outline" title="Appartient à">
          <Chip
            label="Tout le monde"
            selected={draft.ownerId === undefined}
            onPress={() => setDraft((d) => ({ ...d, ownerId: undefined }))}
          />
          {members.map((member) => (
            <Chip
              key={member.user.id}
              label={member.user.displayName}
              selected={draft.ownerId === member.user.id}
              onPress={() => setDraft((d) => ({ ...d, ownerId: member.user.id }))}
            />
          ))}
        </FilterSection>

        <FilterSection icon="sparkles-outline" title="État">
          <Chip
            label="Tous"
            selected={draft.condition === undefined}
            onPress={() => setDraft((d) => ({ ...d, condition: undefined }))}
          />
          {CONDITION_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.condition === option.value}
              onPress={() => setDraft((d) => ({ ...d, condition: option.value }))}
            />
          ))}
        </FilterSection>

        <FilterSection icon="swap-vertical-outline" title="Trier par">
          {COLLECTION_SORT_PRESETS.map((preset) => (
            <Chip
              key={preset.key}
              label={preset.label}
              selected={isSortPresetSelected(preset, draft)}
              onPress={() => setDraft((d) => ({ ...d, sort: preset.sort, order: preset.order }))}
            />
          ))}
        </FilterSection>
      </View>
    </ScreenContainer>
  );
}
