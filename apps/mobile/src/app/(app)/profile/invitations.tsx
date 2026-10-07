import { formatInvitationCode, type HouseholdInvitationWithCode } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState, type ReactNode } from 'react';
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
import { useCurrentHouseholdRole } from '../../../hooks/useCurrentHouseholdRole';
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
  const { isAdmin } = useCurrentHouseholdRole();
  const invitationsQuery = useInvitations(householdId, isAdmin);
  const createInvitation = useCreateInvitation(householdId);
  const revokeInvitation = useRevokeInvitation(householdId);

  // Le code en clair n'est renvoyé qu'à l'instant de sa création (jamais par la liste,
  // voir InvitationsService côté API) : on garde donc la réponse complète de `create()` en
  // mémoire plutôt que de dépendre du délai de rafraîchissement de la liste (`invalidateQueries`
  // déclenche un refetch asynchrone qui n'a pas forcément abouti au moment où ce composant
  // se re-rend juste après la création). Il prime sur tout état de la liste, y compris une
  // erreur de ce refetch : une fois perdu, ce code ne peut plus jamais être réaffiché.
  const [justCreated, setJustCreated] = useState<HouseholdInvitationWithCode | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const currentHousehold = households.find((h) => h.id === householdId);
  const invitations = invitationsQuery.data;

  const activeInvitation = justCreated ?? (invitations ?? []).find((i) => i.status === 'pending');

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
      showToast('Invitation désactivée.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setConfirmRevoke(false);
    }
  };

  const handleCopy = async (formattedCode: string) => {
    try {
      await Clipboard.setStringAsync(formattedCode);
      showToast('Code copié', 'success');
    } catch {
      showToast('Impossible de copier le code. Vous pouvez le sélectionner à la main.', 'error');
    }
  };

  // `Share.share` ne rejette pas quand le panneau est simplement fermé (il résout avec
  // `dismissedAction`) : une exception est donc toujours un vrai échec, à signaler.
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
      showToast('Impossible d’ouvrir le partage. Copiez le code à la place.', 'error');
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

  // Squelette/erreur pleine page uniquement sans rien d'exploitable à afficher : un refetch
  // en échec (TanStack Query v5 passe alors `isError` à true en gardant `data`) ne doit
  // jamais remplacer une liste déjà connue ni, surtout, le code tout juste créé.
  const hasContent = justCreated !== null || invitations !== undefined;

  if (!hasContent && invitationsQuery.isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
        <LoadingSkeleton height={160} />
      </ScreenContainer>
    );
  }

  if (!hasContent && invitationsQuery.isError) {
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
  const householdName = currentHousehold?.name ?? 'Notre Nid';

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title" color="primary" accessibilityRole="header">
            Inviter quelqu’un
          </AppText>
          <AppText variant="body" color="textMuted">
            Générez un code à partager avec la personne que vous invitez — aucun email n’est
            nécessaire.
          </AppText>
        </View>

        {formattedCode && activeInvitation ? (
          <InvitationCard>
            <View
              style={{
                gap: theme.spacing.sm,
                alignItems: 'center',
                padding: theme.spacing.lg,
                borderRadius: theme.radii.lg,
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: theme.colors.primaryMuted,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: 2,
                  borderRadius: theme.radii.full,
                  backgroundColor: theme.colors.tintSage,
                }}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={theme.iconSizes.sm}
                  color={theme.colors.primary}
                  accessible={false}
                  importantForAccessibility="no"
                />
                <AppText variant="caption" color="primary">
                  Nouvelle invitation
                </AppText>
              </View>
              <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
                Invitation à rejoindre
              </AppText>
              <AppText
                variant="section"
                color="primary"
                numberOfLines={2}
                style={{ textAlign: 'center' }}
              >
                {householdName}
              </AppText>
              <AppText
                variant="display"
                color="text"
                selectable
                style={{ letterSpacing: 2, textAlign: 'center' }}
              >
                {formattedCode}
              </AppText>
              <AppText variant="caption" color="textMuted" style={{ textAlign: 'center' }}>
                Valable jusqu’au {formatExpiry(activeInvitation.expiresAt)}
              </AppText>
            </View>
            <AppText variant="helper" color="textMuted" style={{ textAlign: 'center' }}>
              Pour rejoindre : ouvrir Notre Nid et saisir ce code.
            </AppText>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
              <Button
                label="Copier"
                variant="ghost"
                style={{ flex: 1, backgroundColor: theme.colors.surface }}
                onPress={() => void handleCopy(formattedCode)}
              />
              <Button
                label="Partager"
                style={{ flex: 1 }}
                onPress={() => void handleShare(formattedCode)}
              />
            </View>
          </InvitationCard>
        ) : activeInvitation ? (
          <InvitationCard>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Ionicons
                name="mail-open-outline"
                size={theme.iconSizes.lg}
                color={theme.colors.primary}
                accessible={false}
                importantForAccessibility="no"
              />
              <View style={{ flex: 1, gap: theme.spacing.xs }}>
                <AppText variant="section" color="primary">
                  Un code est déjà actif
                </AppText>
                <AppText variant="body" color="textMuted">
                  Il n’est affichable qu’au moment de sa création. Valable jusqu’au{' '}
                  {formatExpiry(activeInvitation.expiresAt)}.
                </AppText>
              </View>
            </View>
          </InvitationCard>
        ) : (
          <EmptyState
            icon="mail-outline"
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
          <Button
            label="Désactiver ce code"
            variant="ghost"
            onPress={() => setConfirmRevoke(true)}
          />
        ) : null}
      </View>

      <ConfirmDialog
        visible={confirmRevoke}
        title="Désactiver ce code ?"
        message="Personne ne pourra plus l'utiliser pour rejoindre ce foyer."
        confirmLabel="Désactiver"
        destructive
        loading={revokeInvitation.isPending}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevoke(false)}
      />
    </ScreenContainer>
  );
}

/** Petit « carton d'invitation » : fond lin chaud, une pastille miel en coin. */
function InvitationCard({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.tintLinen,
        overflow: 'hidden',
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 90,
          height: 90,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.tintHoney,
          opacity: 0.7,
        }}
      />
      {children}
    </View>
  );
}
