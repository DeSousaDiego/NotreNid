import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, View } from 'react-native';
import { z } from 'zod';

import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  ScreenContainer,
  TextField,
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

const invitationSchema = z.object({
  email: z.string().min(1, "L'email est requis.").email('Adresse email invalide.'),
});
type InvitationFormValues = z.infer<typeof invitationSchema>;

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

  const [lastToken, setLastToken] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const currentRole = households.find((h) => h.id === householdId)?.role;
  const isAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      const invitation = await createInvitation.mutateAsync(email);
      setLastToken(invitation.token);
      reset({ email: '' });
      showToast('Invitation envoyée.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  });

  const handleRevoke = async () => {
    if (!confirmRevokeId) return;
    try {
      await revokeInvitation.mutateAsync(confirmRevokeId);
      showToast('Invitation révoquée.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setConfirmRevokeId(null);
    }
  };

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <EmptyState
          icon="lock-closed-outline"
          title="Accès réservé"
          message="Seuls les propriétaires et administrateurs peuvent gérer les invitations."
        />
      </ScreenContainer>
    );
  }

  const invitations = (invitationsQuery.data ?? []).filter((invitation) => !invitation.acceptedAt);

  return (
    <ScreenContainer edges={['left', 'right']}>
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label="Inviter par email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.email?.message}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          )}
        />
        <Button
          label="Envoyer l'invitation"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
        />

        {lastToken ? (
          <View
            style={{
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              padding: theme.spacing.md,
              gap: theme.spacing.xs,
            }}
          >
            <AppText variant="label" color="textMuted">
              Jeton d’invitation (développement)
            </AppText>
            <AppText variant="body" selectable>
              {lastToken}
            </AppText>
            <AppText variant="helper" color="textMuted">
              En production, ce jeton est envoyé par email — ici il est affiché pour vous permettre
              de le partager manuellement.
            </AppText>
          </View>
        ) : null}
      </View>

      {invitationsQuery.isLoading ? (
        <View style={{ padding: theme.spacing.lg }}>
          <LoadingSkeleton height={100} />
        </View>
      ) : invitationsQuery.isError ? (
        <ErrorState
          message={getErrorMessage(invitationsQuery.error)}
          onRetry={() => void invitationsQuery.refetch()}
        />
      ) : invitations.length === 0 ? (
        <EmptyState
          icon="mail-outline"
          title="Aucune invitation en attente"
          message="Invitez un proche à rejoindre ce foyer."
        />
      ) : (
        <FlatList
          data={invitations}
          keyExtractor={(invitation) => invitation.id}
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.xs }}
          renderItem={({ item: invitation }) => (
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
                <AppText variant="body">{invitation.email}</AppText>
                <AppText variant="caption" color="textMuted">
                  Expire le {formatExpiry(invitation.expiresAt)}
                </AppText>
              </View>
              <IconButton
                name="close-circle-outline"
                color="danger"
                accessibilityLabel={`Révoquer l'invitation envoyée à ${invitation.email}`}
                onPress={() => setConfirmRevokeId(invitation.id)}
              />
            </View>
          )}
        />
      )}

      <ConfirmDialog
        visible={confirmRevokeId !== null}
        title="Révoquer cette invitation ?"
        message="La personne invitée ne pourra plus rejoindre ce foyer avec ce lien."
        confirmLabel="Révoquer"
        destructive
        loading={revokeInvitation.isPending}
        onConfirm={() => void handleRevoke()}
        onCancel={() => setConfirmRevokeId(null)}
      />
    </ScreenContainer>
  );
}
