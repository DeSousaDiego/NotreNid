import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useWindowDimensions, View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, PasswordField, ScreenContainer, TextField } from '../../components';
import { getErrorMessage } from '../../lib/errorMessage';
import { useAuth } from '../../providers/AuthProvider';
import { useTheme } from '../../theme';

const loginSchema = z.object({
  email: z.string().min(1, "L'email est requis.").email('Adresse email invalide.'),
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LOGIN_ILLUSTRATION = require('../../../assets/images/notre-nid-login.png');
// Dimensions réelles de l'asset (voir apps/mobile/assets/images/notre-nid-login.png) —
// nécessaire pour dériver la hauteur en mode "contain" sans déformer l'image.
const LOGIN_ILLUSTRATION_ASPECT_RATIO = 2188 / 1240;
// Filet de sécurité sur grand écran (tablette) : au-delà, la largeur en 80 % de
// l'écran donnerait une hauteur excessive et repousserait le formulaire trop bas.
const LOGIN_ILLUSTRATION_MAX_HEIGHT = 220;

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const illustrationWidth = windowWidth * 0.8;
  const illustrationHeight = Math.min(
    illustrationWidth / LOGIN_ILLUSTRATION_ASPECT_RATIO,
    LOGIN_ILLUSTRATION_MAX_HEIGHT,
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <ScreenContainer scroll>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <Image
          source={LOGIN_ILLUSTRATION}
          style={{
            width: illustrationWidth,
            height: illustrationHeight,
            alignSelf: 'center',
          }}
          contentFit="contain"
          accessible={false}
        />

        <View
          style={{ alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}
        >
          <AppText variant="display" color="primary">
            Notre Nid
          </AppText>
          <AppText variant="body" color="textMuted">
            Bienvenue dans votre nid.
          </AppText>
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextField
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.email?.message}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <PasswordField
              label="Mot de passe"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.password?.message}
              textContentType="password"
            />
          )}
        />

        {submitError ? (
          <AppText variant="helper" color="danger">
            {submitError}
          </AppText>
        ) : null}

        <Button label="Se connecter" onPress={() => void onSubmit()} loading={isSubmitting} />

        <Link href="/(auth)/register" style={{ textAlign: 'center' }}>
          <AppText variant="label" color="primary">
            Pas encore de compte ? Créer un compte
          </AppText>
        </Link>
      </View>
    </ScreenContainer>
  );
}
