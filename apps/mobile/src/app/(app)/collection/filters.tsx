import type { ItemSortField } from '@notre-nid/shared';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, Chip, ScreenContainer } from '../../../components';
import { CONDITION_OPTIONS } from '../../../constants/condition';
import { useCategories } from '../../../hooks/useCategories';
import { useMembers } from '../../../hooks/useMembers';
import {
  DEFAULT_COLLECTION_FILTERS,
  useCollectionFilters,
  type CollectionFiltersState,
} from '../../../providers/CollectionFiltersProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const SORT_OPTIONS: { value: ItemSortField; label: string }[] = [
  { value: 'createdAt', label: 'Date d’ajout' },
  { value: 'title', label: 'Titre' },
  { value: 'updatedAt', label: 'Dernière modification' },
  { value: 'condition', label: 'État' },
];

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="section">{title}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {children}
      </View>
    </View>
  );
}

/**
 * Écran dédié plutôt qu'une bottom sheet (docs/PHASE_STATUS.md) : l'ancienne
 * implémentation empilait un `Select` — lui-même une bottom sheet — par-dessus
 * la sheet de filtres déjà ouverte, ce qui devenait exigu sur petit écran.
 * Comportement "brouillon + Appliquer" : les changements ne sont commités dans
 * le filtre partagé qu'au tap sur le bouton, jamais en live pendant la sélection.
 */
export default function FiltersScreen() {
  const theme = useTheme();
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
    <ScreenContainer scroll edges={['left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Pressable accessibilityRole="button" onPress={handleReset} hitSlop={8}>
            <AppText variant="label" color="secondary">
              Réinitialiser
            </AppText>
          </Pressable>
        </View>

        <FilterSection title="Catégories">
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

        <FilterSection title="Propriétaires">
          <Chip
            label="Tous"
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

        <FilterSection title="État">
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

        <FilterSection title="Trier par">
          {SORT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.sort === option.value}
              onPress={() => setDraft((d) => ({ ...d, sort: option.value }))}
            />
          ))}
        </FilterSection>

        <FilterSection title="Ordre">
          <Chip
            label="Croissant"
            selected={draft.order === 'asc'}
            onPress={() => setDraft((d) => ({ ...d, order: 'asc' }))}
          />
          <Chip
            label="Décroissant"
            selected={draft.order === 'desc'}
            onPress={() => setDraft((d) => ({ ...d, order: 'desc' }))}
          />
        </FilterSection>

        <Button label="Appliquer les filtres" onPress={handleApply} />
      </View>
    </ScreenContainer>
  );
}
