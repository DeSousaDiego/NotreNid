import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
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

export default function LoginScreen() {
  const theme = useTheme();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

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
        <View style={{ alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
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
