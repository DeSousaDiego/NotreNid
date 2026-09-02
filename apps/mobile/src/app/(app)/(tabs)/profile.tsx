import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AppText,
  Avatar,
  Button,
  LoadingSkeleton,
  ScreenContainer,
  useToast,
} from '../../../components';
import { useExportCollection } from '../../../hooks/useExports';
import { useHouseholds } from '../../../hooks/useHouseholds';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useAuth } from '../../../providers/AuthProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

interface NavRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function NavRow({ icon, label, onPress }: NavRowProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 44,
        paddingVertical: theme.spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={theme.iconSizes.md} color={theme.colors.primary} />
      <AppText variant="body" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={theme.iconSizes.sm} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { user, logout, logoutAllDevices } = useAuth();
  const { householdId, households, clearSelection } = useHousehold();
  const householdsQuery = useHouseholds(true);

  const currentHousehold = households.find((h) => h.id === householdId);
  const exportCollection = useExportCollection(householdId, currentHousehold?.name ?? 'Notre Nid');

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await exportCollection.mutateAsync(format);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xl }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar displayName={user?.displayName ?? ''} avatarUrl={user?.avatarUrl} size={56} />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="title">{user?.displayName}</AppText>
            <AppText variant="body" color="textMuted">
              {user?.email}
            </AppText>
          </View>
        </View>

        <NavRow
          icon="person-outline"
          label="Modifier mon profil"
          onPress={() => router.push('/(app)/profile/edit')}
        />

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Foyer actuel</AppText>
          <AppText variant="body">{currentHousehold?.name ?? '—'}</AppText>

          {households.length > 1 ? (
            <Button label="Changer de foyer" variant="ghost" onPress={clearSelection} />
          ) : null}

          {householdsQuery.isError ? (
            <AppText variant="helper" color="danger">
              Impossible de charger vos foyers.
            </AppText>
          ) : null}
        </View>

        <View>
          <AppText variant="section" style={{ marginBottom: theme.spacing.xs }}>
            Votre nid
          </AppText>
          <NavRow
            icon="people-outline"
            label="Membres"
            onPress={() => router.push('/(app)/profile/members')}
          />
          <NavRow
            icon="mail-outline"
            label="Invitations"
            onPress={() => router.push('/(app)/profile/invitations')}
          />
          <NavRow
            icon="pricetag-outline"
            label="Catégories"
            onPress={() => router.push('/(app)/profile/categories')}
          />
          <NavRow
            icon="archive-outline"
            label="Archives"
            onPress={() => router.push('/(app)/profile/archives')}
          />
          <NavRow
            icon="link-outline"
            label="Rejoindre un foyer"
            onPress={() => router.push('/(app)/profile/join')}
          />
        </View>

        {householdsQuery.isLoading ? <LoadingSkeleton height={40} /> : null}

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Exporter la collection</AppText>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Exporter en JSON"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => void handleExport('json')}
              loading={exportCollection.isPending}
            />
            <Button
              label="Exporter en CSV"
              variant="ghost"
              style={{ flex: 1 }}
              onPress={() => void handleExport('csv')}
              loading={exportCollection.isPending}
            />
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Se déconnecter" variant="secondary" onPress={() => void logout()} />
          <Button
            label="Se déconnecter de tous les appareils"
            variant="ghost"
            onPress={() => void logoutAllDevices()}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
