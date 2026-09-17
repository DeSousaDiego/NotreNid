import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Select, StarRating, TextField } from '../../components';
import { CONDITION_OPTIONS } from '../../constants/condition';
import { useTheme } from '../../theme';

import type { ItemFormValues } from './schema';

export interface StepCopyProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
}

/**
 * Étape 2 sur 3 — Votre exemplaire : état, note et commentaire personnel sur CET
 * exemplaire (par opposition à l'œuvre elle-même, décrite à l'étape 1). Volontairement
 * courte (Bloc 2) — ne pas ajouter de champ pour occuper l'espace.
 */
export function StepCopy({ control, errors }: StepCopyProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Controller
        control={control}
        name="condition"
        render={({ field }) => (
          <View>
            <Select
              label="État"
              value={field.value}
              onChange={(value) => value && field.onChange(value)}
              allowClear={false}
              options={CONDITION_OPTIONS}
            />
            {errors.condition ? (
              <AppText variant="helper" color="danger" style={{ marginTop: 4 }}>
                {errors.condition.message}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="rating"
        render={({ field }) => (
          <View>
            <AppText variant="label" color="textMuted" style={{ marginBottom: 4 }}>
              Note (optionnelle)
            </AppText>
            <StarRating value={field.value} onChange={field.onChange} />
          </View>
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            label="Notes"
            placeholder="Votre avis, une anecdote, l’état constaté, une dédicace…"
            helperText="Votre commentaire personnel sur cet exemplaire précis."
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.notes?.message}
            multiline
            numberOfLines={3}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
            maxLength={2000}
          />
        )}
      />
    </View>
  );
}
