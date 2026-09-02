import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { z } from 'zod';

import {
  AppText,
  Avatar,
  BottomSheet,
  Button,
  ScreenContainer,
  TextField,
  useToast,
} from '../../../components';
import { useAvatarPicker } from '../../../hooks/useAvatarPicker';
import { useUpdateProfile } from '../../../hooks/useProfileMutations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useAuth } from '../../../providers/AuthProvider';
import { useTheme } from '../../../theme';

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Le nom est requis.').max(80, 'Le nom est trop long.'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const AVATAR_SIZE = 96;

export default function EditProfileScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const avatarPicker = useAvatarPicker();
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: user?.displayName ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await updateProfile.mutateAsync({ displayName: values.displayName.trim() });
      showToast('Votre profil a été mis à jour.', 'success');
      router.back();
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const isBusy = isSubmitting || updateProfile.isPending;
  const isAvatarBusy = avatarPicker.isUploading || avatarPicker.isRemoving;

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
            onPress={() => setAvatarSheetOpen(true)}
            disabled={isAvatarBusy}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          >
            <Avatar
              displayName={user?.displayName ?? ''}
              avatarUrl={user?.avatarUrl}
              size={AVATAR_SIZE}
            />
            {isAvatarBusy ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: theme.radii.full,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={theme.colors.onPrimary} />
              </View>
            ) : (
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 32,
                  height: 32,
                  borderRadius: theme.radii.full,
                  backgroundColor: theme.colors.secondary,
                  borderWidth: 2,
                  borderColor: theme.colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={16} color={theme.colors.onPrimary} />
              </View>
            )}
          </Pressable>
          {avatarPicker.error ? (
            <AppText variant="helper" color="danger" style={{ textAlign: 'center' }}>
              {avatarPicker.error}
            </AppText>
          ) : null}
        </View>

        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label="Nom affiché"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.displayName?.message}
              maxLength={80}
            />
          )}
        />

        <View style={{ gap: theme.spacing.xs }}>
          <AppText variant="label" color="textMuted">
            Email
          </AppText>
          <AppText variant="body">{user?.email}</AppText>
          <AppText variant="helper" color="textMuted">
            Pour changer votre email, contactez-nous.
          </AppText>
        </View>

        {submitError ? (
          <AppText variant="helper" color="danger">
            {submitError}
          </AppText>
        ) : null}

        <Button label="Enregistrer" onPress={() => void onSubmit()} loading={isBusy} />
      </View>

      <BottomSheet
        visible={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        title="Photo de profil"
        scrollable={false}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <AvatarSourceOption
            icon="camera-outline"
            label="Prendre une photo"
            onPress={() => {
              setAvatarSheetOpen(false);
              void avatarPicker.pickFromCamera();
            }}
          />
          <AvatarSourceOption
            icon="images-outline"
            label="Choisir dans la galerie"
            onPress={() => {
              setAvatarSheetOpen(false);
              void avatarPicker.pickFromLibrary();
            }}
          />
          {user?.avatarUrl ? (
            <AvatarSourceOption
              icon="trash-outline"
              label="Retirer la photo"
              destructive
              onPress={() => {
                setAvatarSheetOpen(false);
                void avatarPicker.removePhoto();
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

function AvatarSourceOption({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Ionicons
        name={icon}
        size={theme.iconSizes.md}
        color={destructive ? theme.colors.danger : theme.colors.primary}
      />
      <AppText variant="body" color={destructive ? 'danger' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}
