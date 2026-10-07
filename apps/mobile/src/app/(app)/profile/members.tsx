import type { HouseholdMember, HouseholdRole } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  AppText,
  Avatar,
  BottomSheet,
  ConfirmDialog,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  NavigationRow,
  RowGroup,
  ScreenContainer,
  useToast,
} from '../../../components';
import { useCurrentHouseholdRole } from '../../../hooks/useCurrentHouseholdRole';
import { useMembers } from '../../../hooks/useMembers';
import {
  useLeaveHousehold,
  useRemoveMember,
  useUpdateMemberRole,
} from '../../../hooks/useMemberMutations';
import { getErrorMessage } from '../../../lib/errorMessage';
import {
  HOUSEHOLD_ROLE_OPTIONS,
  householdHeadcountLabel,
  householdRoleLabel,
} from '../../../lib/householdRoles';
import { useAuth } from '../../../providers/AuthProvider';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

export default function MembersScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { householdId, clearSelection } = useHousehold();
  const { isAdmin } = useCurrentHouseholdRole();
  const membersQuery = useMembers(householdId);
  const updateRole = useUpdateMemberRole(householdId);
  const removeMember = useRemoveMember(householdId);
  const leaveHousehold = useLeaveHousehold(householdId);

  const [managedMember, setManagedMember] = useState<HouseholdMember | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<HouseholdMember | null>(null);
  const [confirmPromote, setConfirmPromote] = useState<HouseholdMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Foyer en cours de départ : dès que le contexte bascule sur un autre foyer (sélection
  // automatique de `HouseholdProvider` une fois le foyer quitté retiré de la liste), cet
  // écran ne doit plus rien afficher — il n'appartient qu'au foyer quitté, et la
  // navigation vers l'Accueil suit immédiatement.
  const [leavingHouseholdId, setLeavingHouseholdId] = useState<string | null>(null);

  const applyRole = async (member: HouseholdMember, role: HouseholdRole) => {
    try {
      await updateRole.mutateAsync({ userId: member.user.id, role });
      showToast('Rôle mis à jour.', 'success');
      setConfirmPromote(null);
      setManagedMember(null);
    } catch (error) {
      setConfirmPromote(null);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleSelectRole = (role: HouseholdRole) => {
    if (!managedMember || role === managedMember.role) return;
    // Confier la responsabilité du foyer n'est pas un simple réglage : confirmation d'abord.
    if (role === 'OWNER') {
      setConfirmPromote(managedMember);
      return;
    }
    void applyRole(managedMember, role);
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

  // Séquence : départ confirmé par l'API → cache des foyers cohérent (foyer quitté retiré,
  // liste rechargée, données du foyer purgées — voir `useLeaveHousehold`) → sélection
  // remise à zéro → Accueil. Jamais l'inverse : vider la sélection tant que la liste
  // contient encore le foyer quitté permettait de le re-sélectionner.
  const handleLeave = async () => {
    setLeavingHouseholdId(householdId);
    try {
      await leaveHousehold.mutateAsync();
    } catch (error) {
      setLeavingHouseholdId(null);
      setConfirmLeave(false);
      showToast(getErrorMessage(error), 'error');
      return;
    }
    setConfirmLeave(false);
    clearSelection();
    router.replace('/');
    showToast('Vous avez quitté ce foyer.', 'success');
  };

  if (leavingHouseholdId !== null && householdId !== leavingHouseholdId) {
    return <ScreenContainer edges={['left', 'right', 'bottom']}>{null}</ScreenContainer>;
  }

  // `data` d'abord : un refetch en échec garde la dernière liste valide (TanStack Query v5)
  // et ne doit pas la remplacer par un écran d'erreur.
  const members = membersQuery.data;

  if (!members) {
    return (
      <ScreenContainer edges={['left', 'right', 'bottom']}>
        {membersQuery.isError ? (
          <ErrorState
            message={getErrorMessage(membersQuery.error)}
            onRetry={() => void membersQuery.refetch()}
          />
        ) : (
          <LoadingSkeleton height={220} />
        )}
      </ScreenContainer>
    );
  }

  // L'API interdit au dernier propriétaire de partir (LAST_OWNER_CANNOT_LEAVE) : ne pas
  // proposer une action vouée à l'échec. La liste contient toujours l'utilisateur
  // courant (seuls les membres peuvent la lire).
  const currentMember = members.find((member) => member.user.id === user?.id);
  const ownerCount = members.filter((member) => member.role === 'OWNER').length;
  const isLastOwner = currentMember?.role === 'OWNER' && ownerCount <= 1;

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
        <AppText variant="body" color="textMuted">
          {householdHeadcountLabel(members.length)}.
        </AppText>

        <RowGroup>
          {members.map((member) => {
            const isCurrentUser = member.user.id === user?.id;
            return (
              <View
                key={member.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  minHeight: 64,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <Avatar
                  displayName={member.user.displayName}
                  avatarUrl={member.user.avatarUrl}
                  size={44}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <View
                    style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
                  >
                    <AppText variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {member.user.displayName}
                    </AppText>
                    {isCurrentUser ? (
                      <View
                        style={{
                          paddingHorizontal: theme.spacing.sm,
                          borderRadius: theme.radii.full,
                          backgroundColor: theme.colors.tintSage,
                        }}
                      >
                        <AppText variant="caption" color="primary">
                          Vous
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                  <AppText variant="caption" color="textMuted">
                    {householdRoleLabel(member.role)}
                  </AppText>
                </View>
                {isAdmin && !isCurrentUser ? (
                  <IconButton
                    name="ellipsis-horizontal"
                    color="textMuted"
                    accessibilityLabel={`Gérer ${member.user.displayName}`}
                    onPress={() => setManagedMember(member)}
                  />
                ) : null}
              </View>
            );
          })}
        </RowGroup>

        <View style={{ marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md }}>
          {isLastOwner ? (
            <AppText variant="helper" color="textMuted">
              Vous devez nommer un autre responsable avant de pouvoir quitter le foyer.
            </AppText>
          ) : (
            <NavigationRow
              icon="exit-outline"
              label="Quitter ce foyer"
              tone="danger"
              showChevron={false}
              onPress={() => setConfirmLeave(true)}
            />
          )}
        </View>
      </ScrollView>

      <BottomSheet
        visible={managedMember !== null}
        onClose={() => setManagedMember(null)}
        title={managedMember?.user.displayName}
      >
        <View style={{ gap: theme.spacing.lg }}>
          <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.xs }}>
            <AppText variant="label" color="textMuted">
              Place dans le foyer
            </AppText>
            {HOUSEHOLD_ROLE_OPTIONS.map((option) => {
              const selected = managedMember?.role === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.description}
                  accessibilityState={{ checked: selected, disabled: updateRole.isPending }}
                  disabled={updateRole.isPending}
                  onPress={() => handleSelectRole(option.value)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    minHeight: 56,
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radii.md,
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    backgroundColor: selected ? theme.colors.tintSage : theme.colors.surface,
                    opacity: updateRole.isPending ? 0.5 : pressed ? 0.75 : 1,
                  })}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={theme.iconSizes.md}
                    color={selected ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <AppText variant="body" color={selected ? 'primary' : 'text'}>
                      {option.label}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {option.description}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <NavigationRow
            icon="person-remove-outline"
            label="Retirer du foyer"
            tone="danger"
            showChevron={false}
            disabled={updateRole.isPending}
            onPress={() => {
              if (managedMember) setConfirmRemove(managedMember);
            }}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={confirmPromote !== null}
        title={`Donner à ${confirmPromote?.user.displayName ?? ''} la responsabilité du foyer ?`}
        message="Cette personne pourra gérer les membres et les invitations."
        confirmLabel="Confirmer"
        loading={updateRole.isPending}
        onConfirm={() => {
          if (confirmPromote) void applyRole(confirmPromote, 'OWNER');
        }}
        onCancel={() => setConfirmPromote(null)}
      />

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
