import { normalizeInvitationCode } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';

import {
  AppText,
  Button,
  InvitationCodeField,
  ScreenContainer,
  TextField,
  useToast,
} from '../components';
import { useAcceptInvitation } from '../hooks/useInvitations';
import { useCreateHousehold } from '../hooks/useHouseholdMutations';
import { getErrorMessage } from '../lib/errorMessage';
import { useAuth } from '../providers/AuthProvider';
import { useHousehold } from '../providers/HouseholdProvider';
import { useTheme } from '../theme';

const createSchema = z.object({
  name: z.string().min(1, 'Le nom est requis.').max(120, 'Le nom est trop long.'),
});
type CreateFormValues = z.infer<typeof createSchema>;

const joinSchema = z.object({
  code: z.string().min(1, "Le code d'invitation est requis."),
});
type JoinFormValues = z.infer<typeof joinSchema>;

/** Un seul formulaire visible à la fois : choisir d'abord, puis créer ou rejoindre. */
type Mode = 'choose' | 'create' | 'join';

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
  const { selectHousehold } = useHousehold();
  const createHousehold = useCreateHousehold();
  const acceptInvitation = useAcceptInvitation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('choose');

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '' },
  });
  const joinForm = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: '' },
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

  const onJoin = joinForm.handleSubmit(async ({ code }) => {
    setSubmitError(null);
    try {
      const result = await acceptInvitation.mutateAsync(normalizeInvitationCode(code));
      selectHousehold(result.householdId);
      showToast(`Bienvenue dans ${result.householdName} 🌿`, 'success');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const chooseMode = (next: Mode) => {
    setSubmitError(null);
    setMode(next);
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <NestWelcome />

        {mode === 'choose' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Button label="Créer un foyer" onPress={() => chooseMode('create')} />
            <Button label="Rejoindre un foyer" variant="ghost" onPress={() => chooseMode('join')} />
          </View>
        ) : (
          <View
            style={{
              gap: theme.spacing.md,
              padding: theme.spacing.lg,
              borderRadius: theme.radii.xl,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            {mode === 'create' ? (
              <>
                <AppText variant="section" color="primary" accessibilityRole="header">
                  Créer un foyer
                </AppText>
                <Controller
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <TextField
                      label="Nom du foyer"
                      placeholder="Ex. Chez nous"
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
              </>
            ) : (
              <>
                <AppText variant="section" color="primary" accessibilityRole="header">
                  Rejoindre un foyer
                </AppText>
                <AppText variant="body" color="textMuted">
                  Entrez le code d’invitation que l’on vous a partagé.
                </AppText>
                <Controller
                  control={joinForm.control}
                  name="code"
                  render={({ field }) => (
                    <InvitationCodeField
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      errorMessage={joinForm.formState.errors.code?.message}
                    />
                  )}
                />
                <Button
                  label="Rejoindre ce foyer"
                  onPress={() => void onJoin()}
                  loading={joinForm.formState.isSubmitting}
                />
              </>
            )}

            {submitError ? (
              <AppText variant="helper" color="danger" accessibilityRole="alert">
                {submitError}
              </AppText>
            ) : null}

            <Button label="Retour" variant="ghost" onPress={() => chooseMode('choose')} />
          </View>
        )}

        <Button label="Se déconnecter" variant="ghost" onPress={() => void logout()} />
      </View>
    </ScreenContainer>
  );
}

/** En-tête d'accueil : carte sauge, maison dans un cercle crème, formes douces. */
function NestWelcome() {
  const theme = useTheme();
  const decorativeCircle = { position: 'absolute', borderRadius: theme.radii.full } as const;

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.xxl,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.xl,
        backgroundColor: theme.colors.tintSage,
        overflow: 'hidden',
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          decorativeCircle,
          { top: -40, left: -36, width: 120, height: 120, backgroundColor: theme.colors.tintHoney },
        ]}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          decorativeCircle,
          {
            bottom: -32,
            right: -30,
            width: 100,
            height: 100,
            backgroundColor: theme.colors.tintPeach,
          },
        ]}
      />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radii.full,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="home" size={theme.iconSizes.xl} color={theme.colors.primary} />
        <View style={{ position: 'absolute', top: 12, right: 10 }}>
          <Ionicons name="heart" size={theme.iconSizes.sm} color={theme.colors.secondary} />
        </View>
      </View>
      <View style={{ alignItems: 'center', gap: theme.spacing.xs }}>
        <AppText
          variant="title"
          color="primary"
          accessibilityRole="header"
          style={{ textAlign: 'center' }}
        >
          Créez votre nid
        </AppText>
        <AppText variant="body" style={{ textAlign: 'center' }}>
          Commencez votre collection dans un foyer partagé, ou rejoignez celui de quelqu’un que vous
          aimez.
        </AppText>
      </View>
    </View>
  );
}
