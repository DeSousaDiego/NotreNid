import type { HouseholdMember, HouseholdRole } from '@notre-nid/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  ConfirmDialog,
  ErrorState,
  IconButton,
  LoadingSkeleton,
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

      <View style={{ padding: theme.spacing.lg }}>
        {isLastOwner ? (
          <AppText variant="helper" color="textMuted" style={{ textAlign: 'center' }}>
            Pour quitter ce foyer, confiez-le d’abord à quelqu’un d’autre.
          </AppText>
        ) : (
          <Button label="Quitter ce foyer" variant="ghost" onPress={() => setConfirmLeave(true)} />
        )}
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
                  disabled={updateRole.isPending}
                  onPress={() => handleSelectRole(option.value)}
                />
              ))}
            </View>
          </View>
          <Button
            label="Retirer du foyer"
            variant="danger"
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
