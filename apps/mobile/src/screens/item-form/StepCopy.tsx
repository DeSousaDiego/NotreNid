import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { AppText, formatRatingLabel, Select, StarRating, TextField } from '../../components';
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
    <View style={{ gap: theme.spacing.lg }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
              <AppText variant="label" color="textMuted">
                Note (optionnelle)
              </AppText>
              {field.value ? (
                <AppText variant="label" color="primary" testID="rating-value">
                  {formatRatingLabel(field.value)} / 5
                </AppText>
              ) : null}
            </View>
            <StarRating value={field.value} onChange={field.onChange} />
            {field.value ? (
              // Retirer la note était possible (re-toucher l'étoile courante) mais
              // invisible : action explicite, cible tactile ≥ 44.
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retirer la note"
                onPress={() => field.onChange(null)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: theme.spacing.xs,
                  minHeight: 44,
                  paddingRight: theme.spacing.sm,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={theme.iconSizes.md}
                  color={theme.colors.textMuted}
                />
                <AppText variant="label" color="textMuted">
                  Retirer la note
                </AppText>
              </Pressable>
            ) : null}
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
