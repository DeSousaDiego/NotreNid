import type { Category } from '@notre-nid/shared';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, CategoryPicker, Select, StarRating, TextField } from '../../components';
import { CONDITION_OPTIONS } from '../../constants/condition';
import { useTheme } from '../../theme';

import type { ItemFormValues } from './schema';

export interface StepBasicsProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  categories: Category[];
}

/** Étape 1 : catégorie, titre, état, description, notes (docs/NOTRE_NID_PRD.md section 9). */
export function StepBasics({ control, errors, categories }: StepBasicsProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Controller
        control={control}
        name="categoryId"
        render={({ field }) => (
          <View>
            <AppText variant="label" color="textMuted" style={{ marginBottom: 4 }}>
              Catégorie
            </AppText>
            <CategoryPicker
              categories={categories}
              value={field.value || undefined}
              onChange={field.onChange}
            />
            {errors.categoryId ? (
              <AppText variant="helper" color="danger" style={{ marginTop: 4 }}>
                {errors.categoryId.message}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Titre"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.title?.message}
            maxLength={200}
          />
        )}
      />

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
        name="description"
        render={({ field }) => (
          <TextField
            label="Description"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            errorMessage={errors.description?.message}
            multiline
            numberOfLines={3}
            style={{ minHeight: 88, textAlignVertical: 'top' }}
            maxLength={2000}
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextField
            label="Notes"
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
