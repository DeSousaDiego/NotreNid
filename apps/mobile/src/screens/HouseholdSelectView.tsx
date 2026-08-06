import type { HouseholdWithRole } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable } from 'react-native';

import { AppText, ScreenContainer } from '../components';
import { useTheme } from '../theme';

export interface HouseholdSelectViewProps {
  households: HouseholdWithRole[];
  onSelect: (householdId: string) => void;
}

/** Affiché quand l'utilisateur appartient à plusieurs households sans sélection mémorisée valide. */
export function HouseholdSelectView({ households, onSelect }: HouseholdSelectViewProps) {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <AppText variant="title" style={{ marginBottom: theme.spacing.lg }}>
        Choisissez votre nid
      </AppText>
      <FlatList
        data={households}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: theme.spacing.sm }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: theme.spacing.lg,
                borderRadius: theme.radii.md,
                backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <AppText variant="section">{item.name}</AppText>
            <Ionicons
              name="chevron-forward"
              size={theme.iconSizes.md}
              color={theme.colors.textMuted}
            />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}
