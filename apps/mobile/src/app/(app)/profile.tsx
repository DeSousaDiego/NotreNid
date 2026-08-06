import { ScrollView, View } from 'react-native';

import { AppText, Button, ErrorState, LoadingSkeleton, ScreenContainer } from '../../components';
import { useHouseholds } from '../../hooks/useHouseholds';
import { useMembers } from '../../hooks/useMembers';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../providers/AuthProvider';
import { useHousehold } from '../../providers/HouseholdProvider';
import { useTheme } from '../../theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const { householdId, households, clearSelection } = useHousehold();
  const householdsQuery = useHouseholds(true);
  const membersQuery = useMembers(householdId);

  const currentHousehold = households.find((h) => h.id === householdId);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.xl }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">Profil</AppText>
          <AppText variant="body">{user?.displayName}</AppText>
          <AppText variant="body" color="textMuted">
            {user?.email}
          </AppText>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Foyer actuel</AppText>
          <AppText variant="body">{currentHousehold?.name ?? '—'}</AppText>

          {membersQuery.isLoading ? (
            <LoadingSkeleton height={60} />
          ) : membersQuery.isError ? (
            <ErrorState
              message={getErrorMessage(membersQuery.error)}
              onRetry={() => void membersQuery.refetch()}
            />
          ) : (
            <View style={{ gap: theme.spacing.xs }}>
              {(membersQuery.data ?? []).map((member) => (
                <View
                  key={member.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: theme.spacing.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <AppText variant="body">{member.user.displayName}</AppText>
                  <AppText variant="caption" color="textMuted">
                    {roleLabel(member.role)}
                  </AppText>
                </View>
              ))}
            </View>
          )}

          {households.length > 1 ? (
            <Button
              label="Changer de foyer"
              variant="ghost"
              onPress={clearSelection}
              style={{ marginTop: theme.spacing.sm }}
            />
          ) : null}
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Catégories, invitations, exports</AppText>
          <AppText variant="body" color="textMuted">
            Bientôt disponibles.
          </AppText>
        </View>

        {householdsQuery.isError ? (
          <AppText variant="helper" color="danger">
            {getErrorMessage(householdsQuery.error)}
          </AppText>
        ) : null}

        <Button label="Se déconnecter" variant="secondary" onPress={() => void logout()} />
      </ScrollView>
    </ScreenContainer>
  );
}

function roleLabel(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'Propriétaire';
    case 'ADMIN':
      return 'Administrateur';
    default:
      return 'Membre';
  }
}
