import type { Category } from '@notre-nid/shared';
import { Fragment } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AppText, CategoryIllustration, Chip, CountrySelect, TextField } from '../../components';
import { normalizeScannedBarcode } from '../../lib/barcodeScanner';
import { useTheme } from '../../theme';

import {
  countryLabelForSlug,
  metadataFieldsForSlug,
  type MetadataFieldConfig,
} from './metadataFields';
import type { ItemFormValues } from './schema';

/**
 * Emplacement du champ Code-barres — générique à l'item (`Item.barcode`), jamais
 * une métadonnée de catégorie (voir docs/DECISIONS.md) : il n'appartient donc à
 * aucune des listes `BOOK_FIELDS`/`CD_FIELDS`/`DVD_FIELDS`, juste inséré juste
 * après le champ identifiant le plus proche de la catégorie (ISBN pour un
 * livre, artiste pour un CD, réalisateur pour un DVD). Catégorie personnalisée
 * (absente d'ici) : pas de champ Code-barres, comportement inchangé.
 */
const BARCODE_FIELD_ANCHOR: Partial<Record<string, MetadataFieldConfig['key']>> = {
  book: 'isbn',
  cd: 'artist',
  dvd: 'director',
};

export interface StepInformationProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  category: Category;
  onChangeCategoryPress?: () => void;
}

/**
 * Étape 1 sur 3 — Informations : titre, champs spécifiques à la catégorie (déjà fixée
 * en amont du formulaire, voir ItemFormScreen), pays, puis description en dernier —
 * volontairement après les métadonnées pour ne pas couper la lecture de l'étape par un
 * grand champ multiligne dès le haut de l'écran (Bloc 2).
 */
export function StepInformation({
  control,
  errors,
  category,
  onChangeCategoryPress,
}: StepInformationProps) {
  const theme = useTheme();
  const systemFields = metadataFieldsForSlug(category.slug);
  const customSchema = category.metadataSchema ?? [];

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <CategoryIllustration slug={category.slug} size={28} />
          <AppText variant="label" color="textMuted">
            {category.name}
          </AppText>
        </View>
        {onChangeCategoryPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Changer de catégorie"
            onPress={onChangeCategoryPress}
            hitSlop={8}
          >
            <AppText variant="label" color="secondary">
              Changer
            </AppText>
          </Pressable>
        ) : null}
      </View>

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

      {systemFields ? (
        systemFields.map((fieldConfig) => (
          <Fragment key={fieldConfig.key}>
            <Controller
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
            {fieldConfig.key === BARCODE_FIELD_ANCHOR[category.slug] ? (
              <Controller
                control={control}
                name="barcode"
                render={({ field }) => (
                  <TextField
                    label="Code-barres"
                    value={field.value ?? ''}
                    // Même normalisation que le scan caméra (trim + chiffres
                    // uniquement, jamais de conversion `Number` — un zéro
                    // initial reste donc intact) : voir `lib/barcodeScanner.ts`.
                    onChangeText={(text) => field.onChange(normalizeScannedBarcode(text))}
                    onBlur={field.onBlur}
                    keyboardType="numeric"
                  />
                )}
              />
            ) : null}
          </Fragment>
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

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextField
            label="Description"
            placeholder="Le résumé, le synopsis ou la présentation de l’œuvre…"
            helperText="La présentation de l’œuvre elle-même, indépendamment de votre exemplaire."
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
    </View>
  );
}
