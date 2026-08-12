import type { Category } from '@notre-nid/shared';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Select, TextField } from '../../components';
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
            <Select
              label="Catégorie"
              value={field.value || undefined}
              onChange={(value) => field.onChange(value ?? '')}
              allowClear={false}
              placeholder="Choisissez une catégorie"
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
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
