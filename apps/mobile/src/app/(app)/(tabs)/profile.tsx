import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AppText,
  Avatar,
  NavigationRow,
  RowGroup,
  ScreenContainer,
  useToast,
} from '../../../components';
import { useCurrentHouseholdRole } from '../../../hooks/useCurrentHouseholdRole';
import { useExportCollection } from '../../../hooks/useExports';
import { useHouseholds } from '../../../hooks/useHouseholds';
import { useMembers } from '../../../hooks/useMembers';
import { useTabBarClearance } from '../../../hooks/useTabBarClearance';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useAuth } from '../../../providers/AuthProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { HouseholdCard } from '../../../screens/profile/HouseholdCard';
import { useTheme } from '../../../theme';

/**
 * Profil : d'abord qui je suis (compact), puis le foyer — cœur de l'écran —, la
 * navigation du nid, les actions plus rares, et enfin la déconnexion, volontairement
 * discrète. Aucune logique métier ici : uniquement de la mise en scène.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { user, logout, logoutAllDevices } = useAuth();
  const { householdId, households, clearSelection } = useHousehold();
  const householdsQuery = useHouseholds(true);
  const membersQuery = useMembers(householdId);
  const { role, isAdmin } = useCurrentHouseholdRole();
  const tabBarClearance = useTabBarClearance();

  const currentHousehold = households.find((h) => h.id === householdId);
  const exportCollection = useExportCollection(householdId, currentHousehold?.name ?? 'Notre Nid');

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await exportCollection.mutateAsync(format);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const openInvitations = () => router.push('/(app)/profile/invitations');

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: tabBarClearance }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar displayName={user?.displayName ?? ''} avatarUrl={user?.avatarUrl} size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="section" numberOfLines={1}>
              {user?.displayName}
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={1}>
              {user?.email}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier mon profil"
            onPress={() => router.push('/(app)/profile/edit')}
            hitSlop={4}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.xs,
              minHeight: 44,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radii.full,
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons
              name="create-outline"
              size={theme.iconSizes.sm}
              color={theme.colors.primary}
            />
            <AppText variant="label" color="primary">
              Modifier
            </AppText>
          </Pressable>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <HouseholdCard
            name={currentHousehold?.name ?? 'Votre foyer'}
            role={role}
            members={membersQuery.data?.map((member) => member.user)}
            membersLoading={membersQuery.isLoading}
            canInvite={isAdmin}
            onInvite={openInvitations}
            onSwitchHousehold={households.length > 1 ? clearSelection : undefined}
          />
          {householdsQuery.isError ? (
            <AppText variant="helper" color="danger">
              Impossible de charger vos foyers.
            </AppText>
          ) : null}
        </View>

        <RowGroup title="Votre nid">
          <NavigationRow
            icon="people-outline"
            label="Membres"
            onPress={() => router.push('/(app)/profile/members')}
          />
          {/* Réservées aux OWNER/ADMIN (l'API refuse les autres) : pas d'entrée vers une impasse. */}
          {isAdmin ? (
            <NavigationRow icon="mail-outline" label="Invitations" onPress={openInvitations} />
          ) : null}
          <NavigationRow
            icon="pricetag-outline"
            label="Catégories"
            onPress={() => router.push('/(app)/profile/categories')}
          />
          <NavigationRow
            icon="archive-outline"
            label="Archives"
            onPress={() => router.push('/(app)/profile/archives')}
          />
        </RowGroup>

        <RowGroup title="Autres actions" tone="subtle">
          <NavigationRow
            icon="enter-outline"
            label="Rejoindre un autre foyer"
            onPress={() => router.push('/(app)/profile/join')}
          />
          <NavigationRow
            icon="download-outline"
            label="Sauvegarder la collection"
            description="Tableur (CSV)"
            accessibilityLabel="Sauvegarder la collection en tableur CSV"
            showChevron={false}
            loading={exportCollection.isPending}
            onPress={() => void handleExport('csv')}
          />
          <NavigationRow
            icon="document-text-outline"
            label="Sauvegarder la collection"
            description="Fichier complet (JSON)"
            accessibilityLabel="Sauvegarder la collection en JSON"
            showChevron={false}
            loading={exportCollection.isPending}
            onPress={() => void handleExport('json')}
          />
        </RowGroup>

        {/* Hors de tout groupe, après un large espace : présente mais jamais dominante. */}
        <View style={{ marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}>
          <NavigationRow
            label="Se déconnecter"
            icon="log-out-outline"
            tone="danger"
            showChevron={false}
            onPress={() => void logout()}
          />
          <NavigationRow
            label="Se déconnecter de tous les appareils"
            tone="muted"
            showChevron={false}
            onPress={() => void logoutAllDevices()}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
