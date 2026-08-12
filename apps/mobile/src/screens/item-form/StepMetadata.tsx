import type { Category } from '@notre-nid/shared';
import { Controller, type Control } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Chip, TextField } from '../../components';
import { useTheme } from '../../theme';

import { metadataFieldsForSlug } from './metadataFields';
import type { ItemFormValues } from './schema';

export interface StepMetadataProps {
  control: Control<ItemFormValues>;
  category: Category | undefined;
}

/** Étape 2 : champs spécifiques à la catégorie (docs/NOTRE_NID_PRD.md section 9). */
export function StepMetadata({ control, category }: StepMetadataProps) {
  const theme = useTheme();

  if (!category) {
    return (
      <AppText variant="body" color="textMuted">
        Choisissez d’abord une catégorie à l’étape précédente.
      </AppText>
    );
  }

  const systemFields = metadataFieldsForSlug(category.slug);

  if (systemFields) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        {systemFields.map((fieldConfig) => (
          <Controller
            key={fieldConfig.key}
            control={control}
            name={`metadata.${fieldConfig.key}`}
            render={({ field }) => (
              <TextField
                label={fieldConfig.label}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType={fieldConfig.numeric ? 'numeric' : 'default'}
              />
            )}
          />
        ))}
      </View>
    );
  }

  const customSchema = category.metadataSchema ?? [];

  if (customSchema.length === 0) {
    return (
      <AppText variant="body" color="textMuted">
        Cette catégorie ne définit pas de champ supplémentaire.
      </AppText>
    );
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      {customSchema.map((fieldSchema) => (
        <Controller
          key={fieldSchema.key}
          control={control}
          name={`customMetadata.${fieldSchema.key}`}
          render={({ field }) => {
            if (fieldSchema.type === 'boolean') {
              const isTrue = field.value === 'true';
              const isFalse = field.value === 'false';
              return (
                <View>
                  <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
                    {fieldSchema.label}
                    {fieldSchema.required ? ' *' : ''}
                  </AppText>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
                    <Chip label="Oui" selected={isTrue} onPress={() => field.onChange('true')} />
                    <Chip label="Non" selected={isFalse} onPress={() => field.onChange('false')} />
                  </View>
                </View>
              );
            }

            return (
              <TextField
                label={fieldSchema.required ? `${fieldSchema.label} *` : fieldSchema.label}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType={fieldSchema.type === 'number' ? 'numeric' : 'default'}
              />
            );
          }}
        />
      ))}
    </View>
  );
}
