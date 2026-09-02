import { normalizeInvitationCode } from '@notre-nid/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import {
  AppText,
  Button,
  InvitationCodeField,
  ScreenContainer,
  useToast,
} from '../../../components';
import { useAcceptInvitation } from '../../../hooks/useInvitations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const joinSchema = z.object({
  code: z.string().min(1, "Le code d'invitation est requis."),
});
type JoinFormValues = z.infer<typeof joinSchema>;

/** Rejoindre un household via un code d'invitation (docs/NOTRE_NID_PRD.md, Bloc 2). */
export default function JoinHouseholdScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { selectHousehold } = useHousehold();
  const acceptInvitation = useAcceptInvitation();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({ resolver: zodResolver(joinSchema), defaultValues: { code: '' } });

  const onSubmit = handleSubmit(async ({ code }) => {
    try {
      const result = await acceptInvitation.mutateAsync(normalizeInvitationCode(code));
      selectHousehold(result.householdId);
      showToast(`Bienvenue dans ${result.householdName} 🌿`, 'success');
      router.replace('/');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    }
  });

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="title">Rejoindre un foyer</AppText>
          <AppText variant="body" color="textMuted">
            Entrez le code d’invitation que la personne vous a partagé.
          </AppText>
        </View>

        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <InvitationCodeField
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.code?.message}
            />
          )}
        />

        <Button label="Rejoindre" onPress={() => void onSubmit()} loading={isSubmitting} />
      </View>
    </ScreenContainer>
  );
}
