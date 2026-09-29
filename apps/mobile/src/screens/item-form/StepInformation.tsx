import type { Category } from '@notre-nid/shared';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { AppText, CategoryIllustration, Chip, CountrySelect, TextField } from '../../components';
import { getCategoryTint } from '../../constants/category-icons';
import { normalizeScannedBarcode } from '../../lib/barcodeScanner';
import { useTheme } from '../../theme';

import { FormSection } from './FormSection';
import {
  countryLabelForSlug,
  metadataFieldsForSlug,
  type MetadataFieldConfig,
} from './metadataFields';
import type { ItemFormValues } from './schema';

/**
 * Champs d'identification regroupés à part (« Identifiants »), avec le code-barres —
 * regroupement propre au FORMULAIRE : l'ordre de `metadataFields` (partagé avec la
 * fiche détail) n'est pas modifié.
 */
const IDENTIFIER_KEYS: ReadonlySet<MetadataFieldConfig['key']> = new Set(['isbn']);

/** Exemples seulement là où ils lèvent un doute (texte libre non évident). */
const PLACEHOLDERS: Partial<Record<string, string>> = {
  'book.format': 'Poche, broché, relié…',
  'book.language': 'Français, anglais…',
  'cd.format': 'CD, vinyle…',
  'dvd.format': 'DVD, Blu-ray…',
  'dvd.region': 'Zone 2',
  'dvd.edition': 'Collector, Steelbook…',
};

export interface StepInformationProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  category: Category;
  onChangeCategoryPress?: () => void;
}

/**
 * Étape 1 sur 3 — L'objet : l'œuvre elle-même (titre, champs de la catégorie, pays,
 * description), puis ses identifiants (ISBN, code-barres). Description en fin de
 * section pour ne pas couper la lecture par un grand champ multiligne (Bloc 2).
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
  const workFields = systemFields?.filter((field) => !IDENTIFIER_KEYS.has(field.key)) ?? [];
  const identifierFields = systemFields?.filter((field) => IDENTIFIER_KEYS.has(field.key)) ?? [];

  const renderMetadataField = (fieldConfig: MetadataFieldConfig) => (
    <Controller
      key={fieldConfig.key}
      control={control}
      name={`metadata.${fieldConfig.key}`}
      render={({ field }) => (
        <TextField
          allowScrollFromField
          label={fieldConfig.label}
          placeholder={PLACEHOLDERS[`${category.slug}.${fieldConfig.key}`]}
          value={field.value ?? ''}
          onChangeText={field.onChange}
          onBlur={field.onBlur}
          keyboardType={fieldConfig.numeric ? 'numeric' : 'default'}
        />
      )}
    />
  );

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.sm }}>
        <CategoryPill category={category} onChangePress={onChangeCategoryPress} />
        <AppText variant="helper" color="textMuted">
          Seul le titre est indispensable.
        </AppText>
      </View>

      <FormSection icon="leaf-outline" title="L’œuvre">
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <TextField
              allowScrollFromField
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
          workFields.map(renderMetadataField)
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
                        <Chip
                          label="Oui"
                          selected={isTrue}
                          onPress={() => field.onChange('true')}
                        />
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
                    allowScrollFromField
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
              allowScrollFromField
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
      </FormSection>

      {/* Code-barres : générique à l'item (`Item.barcode`), jamais une métadonnée de
       * catégorie (voir docs/DECISIONS.md) — catégorie personnalisée : pas de champ,
       * comportement inchangé. */}
      {systemFields ? (
        <FormSection icon="barcode-outline" title="Identifiants">
          {identifierFields.map(renderMetadataField)}
          <Controller
            control={control}
            name="barcode"
            render={({ field }) => (
              <TextField
                allowScrollFromField
                label="Code-barres"
                value={field.value ?? ''}
                // Même normalisation que le scan caméra (trim + chiffres uniquement,
                // jamais de conversion `Number` — un zéro initial reste donc intact) :
                // voir `lib/barcodeScanner.ts`.
                onChangeText={(text) => field.onChange(normalizeScannedBarcode(text))}
                onBlur={field.onBlur}
                keyboardType="numeric"
                // Livre uniquement : l'ISBN existe déjà comme identifiant, sans lien
                // avec ce champ (voir docs/DECISIONS.md) — cette aide évite juste de
                // laisser penser que les deux valeurs doivent différer.
                helperText={
                  category.slug === 'book'
                    ? 'Souvent identique à l’ISBN, mais pas toujours.'
                    : undefined
                }
              />
            )}
          />
        </FormSection>
      ) : null}
    </View>
  );
}

/** Rappel de la catégorie : pastille teintée (couleur de l'Accueil) + « Changer ». */
function CategoryPill({
  category,
  onChangePress,
}: {
  category: Category;
  onChangePress?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      testID="category-pill"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: theme.spacing.xs,
        minHeight: 40,
        paddingLeft: theme.spacing.sm,
        paddingRight: onChangePress ? theme.spacing.xs : theme.spacing.md,
        borderRadius: theme.radii.full,
        backgroundColor: theme.colors[getCategoryTint(category.slug)],
      }}
    >
      <CategoryIllustration slug={category.slug} size={24} />
      <AppText variant="label" color="primary">
        {category.name}
      </AppText>
      {onChangePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Changer de catégorie"
          onPress={onChangePress}
          hitSlop={4}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.sm,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <AppText variant="label" color="primary" style={{ textDecorationLine: 'underline' }}>
            Changer
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
