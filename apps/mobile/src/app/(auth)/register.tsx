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

const registerSchema = z.object({
  displayName: z.string().min(1, 'Le prénom est requis.').max(80),
  email: z.string().min(1, "L'email est requis.").email('Adresse email invalide.'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(128),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const theme = useTheme();
  const { register } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await register(values);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  return (
    <ScreenContainer scroll>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <View
          style={{ alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}
        >
          <AppText variant="title" color="primary">
            Créer votre nid
          </AppText>
        </View>

        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <TextField
              label="Prénom"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={errors.displayName?.message}
              textContentType="givenName"
            />
          )}
        />

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
              helperText="8 caractères minimum."
              textContentType="newPassword"
            />
          )}
        />

        {submitError ? (
          <AppText variant="helper" color="danger">
            {submitError}
          </AppText>
        ) : null}

        <Button label="Créer mon compte" onPress={() => void onSubmit()} loading={isSubmitting} />

        <Link href="/(auth)/login" style={{ textAlign: 'center' }}>
          <AppText variant="label" color="primary">
            Déjà un compte ? Se connecter
          </AppText>
        </Link>
      </View>
    </ScreenContainer>
  );
}
