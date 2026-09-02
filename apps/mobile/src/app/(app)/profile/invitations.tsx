import { formatInvitationCode, type HouseholdInvitationWithCode } from '@notre-nid/shared';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Share, View } from 'react-native';

import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
  useToast,
} from '../../../components';
import {
  useCreateInvitation,
  useInvitations,
  useRevokeInvitation,
} from '../../../hooks/useInvitations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

function formatExpiry(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function InvitationsScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { householdId, households } = useHousehold();
  const invitationsQuery = useInvitations(householdId);
  const createInvitation = useCreateInvitation(householdId);
  const revokeInvitation = useRevokeInvitation(householdId);

  // Le code en clair n'est renvoyé qu'à l'instant de sa création (jamais par la liste,
  // voir InvitationsService côté API) : on garde donc la réponse complète de `create()` en
  // mémoire plutôt que de dépendre du délai de rafraîchissement de la liste (`invalidateQueries`
  // déclenche un refetch asynchrone qui n'a pas forcément abouti au moment où ce composant
  // se re-rend juste après la création).
  const [justCreated, setJustCreated] = useState<HouseholdInvitationWithCode | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const currentHousehold = households.find((h) => h.id === householdId);
  const currentRole = currentHousehold?.role;
  const isAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const activeInvitation =
    justCreated ?? (invitationsQuery.data ?? []).find((i) => i.status === 'pending');

  const handleCreate = async () => {
    try {
      const invitation = await createInvitation.mutateAsync(undefined);
      setJustCreated(invitation);
      showToast('Nouveau code généré.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleRevoke = async () => {
    if (!activeInvitation) return;
    try {
      await revokeInvitation.mutateAsync(activeInvitation.id);
      setJustCreated(null);
      showToast('Invitation révoquée.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setConfirmRevoke(false);
    }
  };

  const handleCopy = async (formattedCode: string) => {
    await Clipboard.setStringAsync(formattedCode);
    showToast('Code copié', 'success');
  };

  const handleShare = async (formattedCode: string) => {
    const householdName = currentHousehold?.name ?? 'Notre Nid';
    try {
      await Share.share({
        message: [
          `Je t'invite à rejoindre notre foyer « ${householdName} » sur Notre Nid 🌿`,
          '',
          `Code d'invitation : ${formattedCode}`,
          '',
          'Ouvre Notre Nid puis choisis « Rejoindre un foyer ».',
        ].join('\n'),
      });
    } catch {
      // L'utilisateur a simplement fermé le panneau de partage : rien à signaler.
    }
  };

  if (!isAdmin) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title="Accès réservé"
          message="Seuls les propriétaires et administrateurs peuvent gérer les invitations."
        />
      </ScreenContainer>
    );
  }

  if (invitationsQuery.isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton height={160} />
      </ScreenContainer>
    );
  }

  if (invitationsQuery.isError) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <ErrorState
          message={getErrorMessage(invitationsQuery.error)}
          onRetry={() => void invitationsQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const formattedCode = justCreated ? formatInvitationCode(justCreated.code) : null;

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">Inviter quelqu’un</AppText>
          <AppText variant="body" color="textMuted">
            Générez un code à partager avec la personne que vous invitez — aucun email n’est
            nécessaire.
          </AppText>
        </View>

        {formattedCode && activeInvitation ? (
          <View
            style={[
              {
                borderRadius: theme.radii.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                padding: theme.spacing.lg,
                gap: theme.spacing.sm,
              },
              theme.elevation.low,
            ]}
          >
            <AppText variant="label" color="textMuted">
              CODE D’INVITATION
            </AppText>
            <AppText variant="display" color="primary" selectable>
              {formattedCode}
            </AppText>
            <AppText variant="body" color="textMuted">
              Valable jusqu’au {formatExpiry(activeInvitation.expiresAt)}
            </AppText>
            <AppText variant="helper" color="textMuted">
              Pour rejoindre : ouvrir Notre Nid et saisir ce code.
            </AppText>
            <View
              style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}
            >
              <Button
                label="Copier"
                variant="ghost"
                style={{ flex: 1 }}
                onPress={() => void handleCopy(formattedCode)}
              />
              <Button
                label="Partager"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void handleShare(formattedCode)}
              />
            </View>
          </View>
        ) : activeInvitation ? (
          <View
            style={{
              borderRadius: theme.radii.lg,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.lg,
              gap: theme.spacing.xs,
            }}
          >
            <AppText variant="section">Un code est déjà actif</AppText>
            <AppText variant="body" color="textMuted">
              Il n’est affichable qu’au moment de sa création. Valable jusqu’au{' '}
              {formatExpiry(activeInvitation.expiresAt)}.
            </AppText>
          </View>
        ) : (
          <EmptyState
            icon="key-outline"
            title="Aucune invitation active"
            message="Générez un code pour inviter un proche à rejoindre ce foyer."
          />
        )}

        <Button
          label={activeInvitation ? 'Générer un nouveau code' : 'Inviter quelqu’un'}
          onPress={() => void handleCreate()}
          loading={createInvitation.isPending}
        />

        {activeInvitation ? (
          <Button label="Révoquer ce code" variant="ghost" onPress={() => setConfirmRevoke(true)} />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmRevoke}
        title="Révoquer ce code ?"
        message="Personne ne pourra plus l'utiliser pour rejoindre ce foyer."
        confirmLabel="Révoquer"
        destructive
        loading={revokeInvitation.isPending}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevoke(false)}
      />
    </ScreenContainer>
  );
}
