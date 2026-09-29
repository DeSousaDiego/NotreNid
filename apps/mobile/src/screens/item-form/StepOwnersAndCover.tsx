import { Ionicons } from '@expo/vector-icons';
import { getCountryName, type Category, type HouseholdMember } from '@notre-nid/shared';
import { useEffect, useState } from 'react';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, Avatar, BottomSheet, ConditionBadge, ItemCover } from '../../components';
import { getCategoryTint } from '../../constants/category-icons';
import { useTheme } from '../../theme';

import { FormSection } from './FormSection';
import { countryLabelForSlug } from './metadataFields';
import type { ItemFormValues } from './schema';
import { useCoverPicker } from './useCoverPicker';

export interface StepOwnersAndCoverProps {
  control: Control<ItemFormValues>;
  errors: FieldErrors<ItemFormValues>;
  members: HouseholdMember[];
  category: Category;
  householdId: string | null;
  values: ItemFormValues;
  /** Remonte l'état d'envoi de la couverture au formulaire, qui bloque la
   * soumission et « Précédent » tant qu'il est vrai (voir `ItemFormScreen`). */
  onUploadingChange?: (isUploading: boolean) => void;
}

/** Étape 3 sur 3 — Dans votre nid : propriétaires, couverture et récapitulatif. */
export function StepOwnersAndCover({
  control,
  errors,
  members,
  category,
  householdId,
  values,
  onUploadingChange,
}: StepOwnersAndCoverProps) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Controller
        control={control}
        name="ownerIds"
        render={({ field }) => (
          <FormSection icon="home-outline" title="À qui appartient-il ?">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {members.map((member) => {
                const selected = field.value.includes(member.user.id);
                return (
                  <OwnerChip
                    key={member.user.id}
                    member={member}
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
              <AppText variant="helper" color="danger">
                {errors.ownerIds.message}
              </AppText>
            ) : null}
          </FormSection>
        )}
      />

      <Controller
        control={control}
        name="coverImageUrl"
        render={({ field }) => (
          <CoverPickerField
            householdId={householdId}
            categorySlug={category.slug}
            value={field.value ?? ''}
            onChange={field.onChange}
            onUploadingChange={onUploadingChange}
          />
        )}
      />

      {/* Petite synthèse chaleureuse : fond sauge, pas de bordure. */}
      <View
        testID="item-form-summary"
        style={{
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.tintSage,
          padding: theme.spacing.lg,
          gap: theme.spacing.xs,
        }}
      >
        <AppText
          variant="label"
          color="primary"
          accessibilityRole="header"
          style={{ marginBottom: theme.spacing.xs }}
        >
          Récapitulatif
        </AppText>
        <SummaryRow label="Titre" value={values.title || '—'} />
        <SummaryRow label="Catégorie" value={category.name} />
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
            label={countryLabelForSlug(category.slug)}
            value={values.countryCodes.map((code) => getCountryName(code) ?? code).join(', ')}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Membre du foyer : avatar + prénom, case à cocher (plusieurs propriétaires possibles). */
function OwnerChip({
  member,
  selected,
  onPress,
}: {
  member: HouseholdMember;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={member.user.displayName}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        minHeight: 48,
        paddingLeft: theme.spacing.xs,
        paddingRight: theme.spacing.md,
        borderRadius: theme.radii.full,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Avatar displayName={member.user.displayName} avatarUrl={member.user.avatarUrl} size={36} />
      <AppText variant="label" color={selected ? 'onPrimary' : 'text'}>
        {member.user.displayName}
      </AppText>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={theme.iconSizes.md}
        color={selected ? theme.colors.onPrimary : theme.colors.primaryMuted}
        accessible={false}
        importantForAccessibility="no"
      />
    </Pressable>
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
  categorySlug,
  value,
  onChange,
  onUploadingChange,
}: {
  householdId: string | null;
  categorySlug: string;
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (isUploading: boolean) => void;
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
    // Transmis tel quel (jamais relayé par un effet) : le hook l'appelle de façon
    // synchrone dès l'appui sur une source d'image, avant tout `await`.
    onUploadingChange,
  });

  // Jamais d'état « envoi en cours » bloqué chez le parent si ce champ se démonte
  // (ex. sortie du formulaire) pendant un upload.
  useEffect(() => () => onUploadingChange?.(false), [onUploadingChange]);

  return (
    <FormSection icon="image-outline" title="Couverture">
      <Pressable
        testID="cover-picker"
        accessibilityRole="button"
        accessibilityLabel={previewUri ? 'Remplacer la couverture' : 'Ajouter une couverture'}
        onPress={() => setSourceSheetOpen(true)}
        disabled={isUploading}
        style={({ pressed }) => ({
          width: 120,
          height: 160,
          borderRadius: theme.radii.lg,
          // Teinte de la catégorie (Livre sauge / CD pêche / DVD miel), comme sur l'Accueil.
          backgroundColor: theme.colors[getCategoryTint(categorySlug)],
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {isUploading ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : previewUri ? (
          <>
            <ItemCover
              uri={previewUri}
              categorySlug={categorySlug}
              illustrationSize={56}
              style={{ width: '100%', height: '100%' }}
            />
            {/* Repère visuel « remplacer » : l'action est déjà portée par le libellé
             * accessible de la zone entière. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute',
                bottom: theme.spacing.xs,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                borderRadius: theme.radii.full,
                backgroundColor: theme.colors.surface,
              }}
            >
              <Ionicons
                name="camera-outline"
                size={theme.iconSizes.sm}
                color={theme.colors.primary}
              />
              <AppText variant="caption" color="primary">
                Remplacer
              </AppText>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: theme.spacing.xs, padding: theme.spacing.sm }}>
            <Ionicons
              name="camera-outline"
              size={theme.iconSizes.xl}
              color={theme.colors.primary}
              accessible={false}
            />
            <AppText variant="caption" color="primary" style={{ textAlign: 'center' }}>
              Ajouter une image
            </AppText>
          </View>
        )}
      </Pressable>
      {isUploading ? (
        <AppText variant="helper" color="textMuted">
          Envoi de l’image en cours…
        </AppText>
      ) : null}
      {previewUri && !isUploading ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retirer la couverture"
          onPress={() => void removeImage()}
          disabled={isRemoving}
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
          <Ionicons name="trash-outline" size={theme.iconSizes.md} color={theme.colors.danger} />
          <AppText variant="label" color="danger">
            {isRemoving ? 'Suppression…' : 'Retirer la couverture'}
          </AppText>
        </Pressable>
      ) : null}
      {error ? (
        <AppText variant="helper" color="danger">
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
    </FormSection>
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
