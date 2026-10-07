import { normalizeInvitationCode } from '@notre-nid/shared';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useFetchHouseholds } from '../../../hooks/useHouseholds';
import { useAcceptInvitation } from '../../../hooks/useInvitations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const joinSchema = z.object({
  code: z.string().min(1, "Le code d'invitation est requis."),
});
type JoinFormValues = z.infer<typeof joinSchema>;

interface JoinedHousehold {
  householdId: string;
  householdName: string;
}

/** Rejoindre un household via un code d'invitation (docs/NOTRE_NID_PRD.md, Bloc 2). */
export default function JoinHouseholdScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { householdId, households, selectHousehold } = useHousehold();
  const currentHouseholdName = households.find((h) => h.id === householdId)?.name;
  const acceptInvitation = useAcceptInvitation();
  const fetchHouseholds = useFetchHouseholds();

  // Invitation acceptée par l'API mais liste des foyers pas encore rechargée (échec
  // réseau) : le code est consommé, on ne peut que retenter le rechargement.
  const [unsyncedJoin, setUnsyncedJoin] = useState<JoinedHousehold | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  // Foyer sélectionné, en attente que `HouseholdProvider` l'ait réellement pris en compte.
  const [selectedJoin, setSelectedJoin] = useState<JoinedHousehold | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({ resolver: zodResolver(joinSchema), defaultValues: { code: '' } });

  // Accueil et message de bienvenue seulement une fois le contexte réellement sur le
  // nouveau foyer — jamais sur l'ancien, même le temps d'un rendu.
  useEffect(() => {
    if (selectedJoin && householdId === selectedJoin.householdId) {
      showToast(`Bienvenue dans ${selectedJoin.householdName} 🌿`, 'success');
      router.replace('/');
    }
  }, [selectedJoin, householdId, showToast]);

  /** Recharge la liste, puis sélectionne le foyer rejoint s'il y figure bien. */
  const syncJoinedHousehold = async (joined: JoinedHousehold) => {
    setIsSyncing(true);
    const isListed = await fetchHouseholds().then(
      (households) => households.some((h) => h.id === joined.householdId),
      () => false,
    );
    setIsSyncing(false);
    if (!isListed) {
      setUnsyncedJoin(joined);
      return;
    }
    setUnsyncedJoin(null);
    selectHousehold(joined.householdId);
    setSelectedJoin(joined);
  };

  const onSubmit = handleSubmit(async ({ code }) => {
    let joined: JoinedHousehold;
    try {
      const result = await acceptInvitation.mutateAsync(normalizeInvitationCode(code));
      joined = { householdId: result.householdId, householdName: result.householdName };
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
      return;
    }
    await syncJoinedHousehold(joined);
  });

  if (unsyncedJoin) {
    return (
      <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ gap: theme.spacing.xs }}>
            <AppText variant="title">Encore un instant</AppText>
            <AppText variant="body" color="textMuted">
              Vous avez bien rejoint « {unsyncedJoin.householdName} », mais la liste de vos foyers
              n’a pas pu être mise à jour. Vérifiez votre connexion et réessayez.
            </AppText>
          </View>
          <Button
            label="Réessayer"
            onPress={() => void syncJoinedHousehold(unsyncedJoin)}
            loading={isSyncing}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radii.full,
              backgroundColor: theme.colors.tintSage,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="enter-outline" size={theme.iconSizes.lg} color={theme.colors.primary} />
          </View>
          <AppText variant="title" color="primary" accessibilityRole="header">
            Rejoindre un autre foyer
          </AppText>
          <AppText variant="body" color="textMuted">
            Entrez le code d’invitation du foyer que vous souhaitez rejoindre.
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

        <Button
          label="Rejoindre ce foyer"
          onPress={() => void onSubmit()}
          loading={isSubmitting || selectedJoin !== null}
        />

        {currentHouseholdName ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              padding: theme.spacing.md,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.tintLinen,
            }}
          >
            <Ionicons
              name="home-outline"
              size={theme.iconSizes.md}
              color={theme.colors.primary}
              accessible={false}
              importantForAccessibility="no"
            />
            <AppText variant="caption" color="text" style={{ flex: 1 }}>
              Vous passerez sur ce nouveau foyer. « {currentHouseholdName} » reste accessible à tout
              moment depuis votre profil.
            </AppText>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
