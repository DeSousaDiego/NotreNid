import type { HouseholdMember, HouseholdRole } from '@notre-nid/shared';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  ScreenContainer,
  useToast,
} from '../../../components';
import { useMembers } from '../../../hooks/useMembers';
import {
  useLeaveHousehold,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../../hooks/useMemberMutations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useAuth } from '../../../providers/AuthProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const ROLE_OPTIONS: { value: HouseholdRole; label: string }[] = [
  { value: 'OWNER', label: 'Propriétaire' },
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MEMBER', label: 'Membre' },
];

function roleLabel(role: HouseholdRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

export default function MembersScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { householdId, households, clearSelection } = useHousehold();
  const membersQuery = useMembers(householdId);
  const updateRole = useUpdateMemberRole(householdId);
  const removeMember = useRemoveMember(householdId);
  const leaveHousehold = useLeaveHousehold(householdId);

  const [managedMember, setManagedMember] = useState<HouseholdMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<HouseholdMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const currentRole = households.find((h) => h.id === householdId)?.role;
  const isAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const handleChangeRole = async (role: HouseholdRole) => {
    if (!managedMember) return;
    try {
      await updateRole.mutateAsync({ userId: managedMember.user.id, role });
      showToast('Rôle mis à jour.', 'success');
      setManagedMember(null);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await removeMember.mutateAsync(confirmRemove.user.id);
      showToast('Membre retiré du foyer.', 'success');
      setConfirmRemove(null);
      setManagedMember(null);
    } catch (error) {
      setConfirmRemove(null);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleLeave = async () => {
    try {
      await leaveHousehold.mutateAsync();
      setConfirmLeave(false);
      clearSelection();
      showToast('Vous avez quitté ce foyer.', 'success');
    } catch (error) {
      setConfirmLeave(false);
      showToast(getErrorMessage(error), 'error');
    }
  };

  if (membersQuery.isLoading) {
    return (
      <ScreenContainer>
        <LoadingSkeleton height={220} />
      </ScreenContainer>
    );
  }

  if (membersQuery.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          message={getErrorMessage(membersQuery.error)}
          onRetry={() => void membersQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const members = membersQuery.data ?? [];

  return (
    <ScreenContainer edges={['left', 'right']}>
      {members.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Aucun membre"
          message="Ce foyer n’a pas de membre."
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(member) => member.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}
          renderItem={({ item: member }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View>
                <AppText variant="body">
                  {member.user.displayName}
                  {member.user.id === user?.id ? ' (vous)' : ''}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {roleLabel(member.role)}
                </AppText>
              </View>
              {isAdmin && member.user.id !== user?.id ? (
                <IconButton
                  name="ellipsis-horizontal"
                  accessibilityLabel={`Gérer ${member.user.displayName}`}
                  onPress={() => setManagedMember(member)}
                />
              ) : null}
            </View>
          )}
        />
      )}

      <View style={{ padding: theme.spacing.lg }}>
        <Button label="Quitter ce foyer" variant="ghost" onPress={() => setConfirmLeave(true)} />
      </View>

      <BottomSheet
        visible={managedMember !== null}
        onClose={() => setManagedMember(null)}
        title={managedMember?.user.displayName}
      >
        <View style={{ gap: theme.spacing.md }}>
          <View>
            <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
              Rôle
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {ROLE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={managedMember?.role === option.value}
                  onPress={() => void handleChangeRole(option.value)}
                />
              ))}
            </View>
          </View>
          <Button
            label="Retirer du foyer"
            variant="danger"
            onPress={() => {
              if (managedMember) setConfirmRemove(managedMember);
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmRemove !== null}
        title="Retirer ce membre ?"
        message={`${confirmRemove?.user.displayName} n’aura plus accès à ce foyer.`}
        confirmLabel="Retirer"
        destructive
        loading={removeMember.isPending}
        onConfirm={() => void handleRemove()}
        onCancel={() => setConfirmRemove(null)}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title="Quitter ce foyer ?"
        message="Vous perdrez l’accès à sa collection. Cette action est irréversible."
        confirmLabel="Quitter"
        destructive
        loading={leaveHousehold.isPending}
        onConfirm={() => void handleLeave()}
        onCancel={() => setConfirmLeave(false)}
      />
    </ScreenContainer>
  );
}
