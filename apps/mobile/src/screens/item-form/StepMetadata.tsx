import type { Category } from '@notre-nid/shared';
import { Controller, type Control } from 'react-hook-form';
import { View } from 'react-native';

import { AppText, Chip, CountrySelect, TextField } from '../../components';
import { useTheme } from '../../theme';

import { countryLabelForSlug, metadataFieldsForSlug } from './metadataFields';
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
  const customSchema = category.metadataSchema ?? [];

  return (
    <View style={{ gap: theme.spacing.md }}>
      {systemFields ? (
        systemFields.map((fieldConfig) => (
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
        ))
      ) : customSchema.length === 0 ? (
        <AppText variant="body" color="textMuted">
          Cette catégorie ne définit pas de champ supplémentaire.
        </AppText>
      ) : (
        customSchema.map((fieldSchema) => (
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
                      <Chip
                        label="Non"
                        selected={isFalse}
                        onPress={() => field.onChange('false')}
                      />
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
        ))
      )}

      <Controller
        control={control}
        name="countryCodes"
        render={({ field }) => (
          <CountrySelect
            label={countryLabelForSlug(category.slug)}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
    </View>
  );
}
