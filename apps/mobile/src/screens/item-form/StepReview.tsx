import { Ionicons } from '@expo/vector-icons';
import { getCountryName, type Category, type HouseholdMember } from '@notre-nid/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, BottomSheet, Chip, ConditionBadge } from '../../components';
import { useTheme } from '../../theme';

import { countryLabelForSlug } from './metadataFields';
import type { ItemFormValues } from './schema';
import { useCoverPicker } from './useCoverPicker';

export interface StepReviewProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  members: HouseholdMember[];
  category: Category | undefined;
  householdId: string | null;
  values: ItemFormValues;
}

/** Étape 3 : propriétaires, couverture et récapitulatif (docs/NOTRE_NID_PRD.md section 9). */
export function StepReview({
  control,
  errors,
  members,
  category,
  householdId,
  values,
}: StepReviewProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Controller
        control={control}
        name="ownerIds"
        render={({ field }) => (
          <View>
            <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
              Propriétaires
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
              {members.map((member) => {
                const selected = field.value.includes(member.user.id);
                return (
                  <Chip
                    key={member.user.id}
                    label={member.user.displayName}
                    selected={selected}
                    onPress={() => {
                      field.onChange(
                        selected
                          ? field.value.filter((id) => id !== member.user.id)
                          : [...field.value, member.user.id],
                      );
                    }}
                  />
                );
              })}
            </View>
            {errors.ownerIds ? (
              <AppText variant="helper" color="danger" style={{ marginTop: 6 }}>
                {errors.ownerIds.message}
              </AppText>
            ) : null}
          </View>
        )}
      />

      <Controller
        control={control}
        name="coverImageUrl"
        render={({ field }) => (
          <CoverPickerField
            householdId={householdId}
            value={field.value ?? ''}
            onChange={field.onChange}
          />
        )}
      />

      <View
        style={{
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        }}
      >
        <AppText variant="label" color="textMuted">
          Récapitulatif
        </AppText>
        <SummaryRow label="Titre" value={values.title || '—'} />
        <SummaryRow label="Catégorie" value={category?.name ?? '—'} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="body" color="textMuted">
            État
          </AppText>
          <ConditionBadge condition={values.condition} />
        </View>
        <SummaryRow
          label="Propriétaires"
          value={
            members
              .filter((member) => values.ownerIds.includes(member.user.id))
              .map((member) => member.user.displayName)
              .join(', ') || '—'
          }
        />
        {values.countryCodes.length > 0 ? (
          <SummaryRow
            label={category ? countryLabelForSlug(category.slug) : 'Pays'}
            value={values.countryCodes.map((code) => getCountryName(code) ?? code).join(', ')}
          />
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      <AppText variant="body" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}

function CoverPickerField({
  householdId,
  value,
  onChange,
}: {
  householdId: string | null;
  value: string;
  onChange: (url: string) => void;
}) {
  const theme = useTheme();
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);
  const {
    previewUri,
    isUploading,
    isRemoving,
    error,
    pickFromCamera,
    pickFromLibrary,
    removeImage,
  } = useCoverPicker({
    householdId,
    value,
    onChange,
  });

  return (
    <View>
      <AppText variant="label" color="textMuted" style={{ marginBottom: 6 }}>
        Couverture
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previewUri ? 'Remplacer la couverture' : 'Ajouter une couverture'}
        onPress={() => setSourceSheetOpen(true)}
        disabled={isUploading}
        style={{
          width: 120,
          height: 160,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {isUploading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <AppText variant="caption" color="textMuted" style={{ textAlign: 'center', padding: 8 }}>
            Ajouter une image
          </AppText>
        )}
      </Pressable>
      {previewUri && !isUploading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retirer la couverture"
          onPress={() => void removeImage()}
          disabled={isRemoving}
          style={{ marginTop: theme.spacing.xs }}
        >
          <AppText variant="label" color="danger">
            {isRemoving ? 'Suppression…' : 'Retirer la couverture'}
          </AppText>
        </Pressable>
      ) : null}
      {error ? (
        <AppText variant="helper" color="danger" style={{ marginTop: 6 }}>
          {error}
        </AppText>
      ) : null}

      <BottomSheet
        visible={sourceSheetOpen}
        onClose={() => setSourceSheetOpen(false)}
        title="Ajouter une couverture"
        scrollable={false}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <CoverSourceOption
            icon="camera-outline"
            label="Prendre une photo"
            onPress={() => {
              setSourceSheetOpen(false);
              void pickFromCamera();
            }}
          />
          <CoverSourceOption
            icon="images-outline"
            label="Choisir dans la galerie"
            onPress={() => {
              setSourceSheetOpen(false);
              void pickFromLibrary();
            }}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

function CoverSourceOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
      }}
    >
      <Ionicons name={icon} size={theme.iconSizes.md} color={theme.colors.primary} />
      <AppText variant="body">{label}</AppText>
    </Pressable>
  );
}
