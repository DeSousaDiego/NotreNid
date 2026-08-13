import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, ScreenContainer, TextField, useToast } from '../components';
import { useAcceptInvitation } from '../hooks/useInvitations';
import { useCreateHousehold } from '../hooks/useHouseholdMutations';
import { getErrorMessage } from '../lib/errorMessage';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../theme';

const createSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(120, 'Le nom est trop long.'),
});
type CreateFormValues = z.infer<typeof createSchema>;

const joinSchema = z.object({
  token: z.string().min(1, 'Le jeton d’invitation est requis.'),
});
type JoinFormValues = z.infer<typeof joinSchema>;

/**
 * Affiché quand l'utilisateur n'appartient à aucun household : seul point
 * d'entrée possible pour en créer un ou en rejoindre un par invitation, les
 * onglets (dont Profil > Rejoindre un foyer) ne sont montés qu'une fois un
 * household disponible (docs/NOTRE_NID_PRD.md section 2, points 4 et 6).
 */
export function NoHouseholdView() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { logout } = useAuth();
  const createHousehold = useCreateHousehold();
  const acceptInvitation = useAcceptInvitation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  });
  const joinForm = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { token: '' },
  });

  const onCreate = createForm.handleSubmit(async ({ name }) => {
    setSubmitError(null);
    try {
      await createHousehold.mutateAsync(name.trim());
      showToast('Votre nid a été créé.', 'success');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const onJoin = joinForm.handleSubmit(async ({ token }) => {
    setSubmitError(null);
    try {
      await acceptInvitation.mutateAsync(token.trim());
      showToast('Vous avez rejoint le foyer.', 'success');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">Votre nid est encore vide.</AppText>
          <AppText variant="body" color="textMuted">
            Créez votre foyer, ou rejoignez celui d’un proche avec son invitation.
          </AppText>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Créer un foyer</AppText>
          <Controller
            control={createForm.control}
            name="name"
            render={({ field }) => (
              <TextField
                label="Nom du foyer"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                errorMessage={createForm.formState.errors.name?.message}
                maxLength={120}
              />
            )}
          />
          <Button
            label="Créer mon nid"
            onPress={() => void onCreate()}
            loading={createForm.formState.isSubmitting}
          />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Rejoindre un foyer</AppText>
          <Controller
            control={joinForm.control}
            name="token"
            render={({ field }) => (
              <TextField
                label="Jeton d'invitation"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                errorMessage={joinForm.formState.errors.token?.message}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          />
          <Button
            label="Rejoindre"
            variant="secondary"
            onPress={() => void onJoin()}
            loading={joinForm.formState.isSubmitting}
          />
        </View>

        {submitError ? (
          <AppText variant="helper" color="danger">
            {submitError}
          </AppText>
        ) : null}

        <Button label="Se déconnecter" variant="ghost" onPress={() => void logout()} />
      </View>
    </ScreenContainer>
  );
}
