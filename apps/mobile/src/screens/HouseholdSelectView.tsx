import type { HouseholdWithRole } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText, ScreenContainer } from '../components';
import { householdRoleLabel } from '../lib/householdRoles';
import { useTheme } from '../theme';

export interface HouseholdSelectViewProps {
  households: HouseholdWithRole[];
  onSelect: (householdId: string) => void;
}

/**
 * Affiché quand l'utilisateur appartient à plusieurs households sans sélection
 * mémorisée valide — par construction, aucun foyer n'est donc « actif » ici.
 * Le nombre de membres n'est pas affiché : `GET /households` ne le renvoie pas, et
 * le charger pour chaque foyer coûterait une requête par ligne.
 */
export function HouseholdSelectView({ households, onSelect }: HouseholdSelectViewProps) {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xl }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" color="primary" accessibilityRole="header">
            Choisissez votre nid
          </AppText>
          <AppText variant="body" color="textMuted">
            Vous faites partie de plusieurs foyers. Vous pourrez en changer à tout moment depuis
            votre profil.
          </AppText>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          {households.map((household) => (
            <Pressable
              key={household.id}
              accessibilityRole="button"
              accessibilityLabel={`${household.name}, ${householdRoleLabel(household.role)}`}
              onPress={() => onSelect(household.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: 72,
                padding: theme.spacing.md,
                borderRadius: theme.radii.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.tintSage : theme.colors.surface,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: theme.radii.full,
                  backgroundColor: theme.colors.tintSage,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="home" size={theme.iconSizes.md} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="section" numberOfLines={2}>
                  {household.name}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {householdRoleLabel(household.role)}
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={theme.iconSizes.md}
                color={theme.colors.textMuted}
                accessible={false}
                importantForAccessibility="no"
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
