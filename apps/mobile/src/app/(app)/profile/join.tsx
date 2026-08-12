import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, ScreenContainer, TextField, useToast } from '../../../components';
import { useAcceptInvitation } from '../../../hooks/useInvitations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useTheme } from '../../../theme';

const joinSchema = z.object({
  token: z.string().min(1, 'Le jeton d’invitation est requis.'),
});
type JoinFormValues = z.infer<typeof joinSchema>;

/** Rejoindre un household via un jeton d'invitation (docs/NOTRE_NID_PRD.md section 2, point 6). */
export default function JoinHouseholdScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const acceptInvitation = useAcceptInvitation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({ resolver: zodResolver(joinSchema), defaultValues: { token: '' } });

  const onSubmit = handleSubmit(async ({ token }) => {
    try {
      await acceptInvitation.mutateAsync(token.trim());
      showToast('Vous avez rejoint le foyer.', 'success');
      router.back();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  });

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">Rejoindre un foyer</AppText>
          <AppText variant="body" color="textMuted">
            Collez le jeton d’invitation que vous avez reçu par email pour rejoindre ce foyer.
          </AppText>
        </View>

        <Controller
          control={control}
          name="token"
          render={({ field }) => (
            <TextField
              label="Jeton d'invitation"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.token?.message}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        />

        <Button label="Rejoindre" onPress={() => void onSubmit()} loading={isSubmitting} />
      </View>
    </ScreenContainer>
  );
}
