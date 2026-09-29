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
            {/* Hauteur fixe : la ligne ne « saute » pas quand la note apparaît/disparaît. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                minHeight: 44,
              }}
            >
              <AppText variant="label" color="textMuted">
                Note (optionnelle)
              </AppText>
              {field.value ? (
                <AppText variant="label" color="primary" testID="rating-value">
                  {formatRatingLabel(field.value)} / 5
                </AppText>
              ) : null}
              <View style={{ flex: 1 }} />
              {field.value ? (
                // Action secondaire discrète : petite pastille neutre, jamais un bouton
                // plein ni rouge ; zone tactile ≥ 44 portée par le Pressable englobant.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retirer la note"
                  onPress={() => field.onChange(null)}
                  testID="rating-clear"
                  style={({ pressed }) => ({
                    minHeight: 44,
                    justifyContent: 'center',
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View
                    testID="rating-clear-pill"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 4,
                      borderRadius: theme.radii.full,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    }}
                  >
                    <Ionicons
                      name="close"
                      size={theme.iconSizes.sm}
                      color={theme.colors.textMuted}
                    />
                    <AppText variant="caption" color="textMuted">
                      Retirer
                    </AppText>
                  </View>
                </Pressable>
              ) : null}
            </View>
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
