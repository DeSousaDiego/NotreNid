import type { HouseholdRole, PublicUser } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText, LoadingSkeleton, OwnerAvatarGroup } from '../../components';
import { householdHeadcountLabel, householdRoleLabel } from '../../lib/householdRoles';
import { useTheme } from '../../theme';

export interface HouseholdCardProps {
  name: string;
  role: HouseholdRole | undefined;
  /** `undefined` tant que la liste n'est pas connue (chargement ou échec sans cache). */
  members: PublicUser[] | undefined;
  membersLoading: boolean;
  /** OWNER/ADMIN : seuls rôles autorisés à inviter (l'API revérifie). */
  canInvite: boolean;
  onInvite: () => void;
  /** Proposé seulement si l'utilisateur appartient à plusieurs foyers. */
  onSwitchHousehold?: () => void;
}

const MAX_VISIBLE_AVATARS = 5;

/**
 * Carte foyer, élément dominant du Profil : le foyer est le cœur de Notre Nid,
 * pas un réglage parmi d'autres. Formes décoratives purement visuelles (mêmes
 * pastilles organiques que l'Accueil), masquées aux lecteurs d'écran.
 */
export function HouseholdCard({
  name,
  role,
  members,
  membersLoading,
  canInvite,
  onInvite,
  onSwitchHousehold,
}: HouseholdCardProps) {
  const theme = useTheme();
  const decorativeCircle = { position: 'absolute', borderRadius: theme.radii.full } as const;

  return (
    <View
      testID="household-card"
      // Pas d'ombre : `overflow: hidden` (formes décoratives) la couperait sur iOS, et les
      // tuiles teintées de l'Accueil n'en ont pas non plus — la couleur suffit à l'élever.
      style={{
        gap: theme.spacing.lg,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.tintSage,
        overflow: 'hidden',
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          decorativeCircle,
          {
            top: -40,
            right: -32,
            width: 120,
            height: 120,
            backgroundColor: theme.colors.tintHoney,
            opacity: 0.55,
          },
        ]}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          decorativeCircle,
          {
            bottom: -44,
            left: -28,
            width: 96,
            height: 96,
            backgroundColor: theme.colors.surface,
            opacity: 0.45,
          },
        ]}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', top: theme.spacing.md, right: theme.spacing.md }}
      >
        <Ionicons name="leaf" size={theme.iconSizes.lg} color={theme.colors.primaryMuted} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.full,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="home" size={theme.iconSizes.lg} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2, paddingRight: theme.spacing.xl }}>
          <AppText variant="caption" color="primary">
            Votre foyer
          </AppText>
          <AppText variant="title" color="primary" accessibilityRole="header" numberOfLines={2}>
            {name}
          </AppText>
        </View>
      </View>

      {members ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <OwnerAvatarGroup
            owners={members}
            max={MAX_VISIBLE_AVATARS}
            size={36}
            ringColor="tintSage"
            accessibilityLabel={`Membres : ${members.map((m) => m.displayName).join(', ')}`}
          />
          <AppText variant="body" color="text" style={{ flex: 1 }}>
            {householdHeadcountLabel(members.length)}
          </AppText>
        </View>
      ) : membersLoading ? (
        <LoadingSkeleton width="70%" height={36} />
      ) : null}

      {role ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons
            name={role === 'MEMBER' ? 'person-outline' : 'key-outline'}
            size={theme.iconSizes.sm}
            color={theme.colors.primary}
            accessible={false}
            importantForAccessibility="no"
          />
          <AppText variant="label" color="primary">
            {householdRoleLabel(role)}
          </AppText>
        </View>
      ) : null}

      {canInvite || onSwitchHousehold ? (
        <View style={{ gap: theme.spacing.sm }}>
          {canInvite ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inviter quelqu’un"
              onPress={onInvite}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: theme.spacing.sm,
                minHeight: 44,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.surface,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons
                name="person-add-outline"
                size={theme.iconSizes.md}
                color={theme.colors.primary}
              />
              <AppText variant="label" color="primary">
                Inviter quelqu’un
              </AppText>
            </Pressable>
          ) : null}
          {onSwitchHousehold ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Changer de foyer"
              onPress={onSwitchHousehold}
              hitSlop={8}
              style={({ pressed }) => ({
                alignSelf: 'center',
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.md,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <AppText variant="label" color="primary" style={{ textDecorationLine: 'underline' }}>
                Changer de foyer
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
