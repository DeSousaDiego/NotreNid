import type { Category, CategoryFieldSchema, CategoryFieldType } from '@notre-nid/shared';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  IconButton,
  LoadingSkeleton,
  ScreenContainer,
  Select,
  TextField,
  useToast,
} from '../../../components';
import { useCategories } from '../../../hooks/useCategories';
import {
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../../../hooks/useCategoryMutations';
import { getErrorMessage } from '../../../lib/errorMessage';
import { useHousehold } from '../../../providers/HouseholdProvider';
import { useTheme } from '../../../theme';

const FIELD_TYPE_OPTIONS: { value: CategoryFieldType; label: string }[] = [
  { value: 'string', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'boolean', label: 'Oui / Non' },
];

function sanitizeKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9]+/g, '');
}

export default function CategoriesScreen() {
  const theme = useTheme();
  const { showToast } = useToast();
  const { householdId, households } = useHousehold();
  const categoriesQuery = useCategories(householdId);
  const deleteCategory = useDeleteCategory(householdId);

  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const currentRole = households.find((h) => h.id === householdId)?.role;
  const isAdmin = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteCategory.mutateAsync(confirmDelete.id);
      showToast('Catégorie supprimée.', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setConfirmDelete(null);
    }
  };

  if (editingCategory) {
    return (
      <CategoryForm
        householdId={householdId}
        category={editingCategory === 'new' ? null : editingCategory}
        onDone={() => setEditingCategory(null)}
      />
    );
  }

  if (categoriesQuery.isLoading) {
    return (
      <ScreenContainer>
        <LoadingSkeleton height={220} />
      </ScreenContainer>
    );
  }

  if (categoriesQuery.isError) {
    return (
      <ScreenContainer>
        <ErrorState
          message={getErrorMessage(categoriesQuery.error)}
          onRetry={() => void categoriesQuery.refetch()}
        />
      </ScreenContainer>
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <ScreenContainer edges={['left', 'right']}>
      {categories.length === 0 ? (
        <EmptyState icon="pricetag-outline" title="Aucune catégorie" />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(category) => category.id}
          contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xs }}
          renderItem={({ item: category }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="body">{category.name}</AppText>
                <AppText variant="caption" color="textMuted">
                  {category.isSystem ? 'Catégorie système' : 'Catégorie personnalisée'}
                </AppText>
              </View>
              {!category.isSystem && isAdmin ? (
                <View style={{ flexDirection: 'row' }}>
                  <IconButton
                    name="pencil-outline"
                    accessibilityLabel={`Modifier ${category.name}`}
                    onPress={() => setEditingCategory(category)}
                  />
                  <IconButton
                    name="trash-outline"
                    color="danger"
                    accessibilityLabel={`Supprimer ${category.name}`}
                    onPress={() => setConfirmDelete(category)}
                  />
                </View>
              ) : null}
            </View>
          )}
        />
      )}

      {isAdmin ? (
        <View style={{ padding: theme.spacing.lg }}>
          <Button label="Ajouter une catégorie" onPress={() => setEditingCategory('new')} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmDelete !== null}
        title="Supprimer cette catégorie ?"
        message="Cette action est irréversible. La suppression échouera si des objets utilisent encore cette catégorie."
        confirmLabel="Supprimer"
        destructive
        loading={deleteCategory.isPending}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </ScreenContainer>
  );
}

function CategoryForm({
  householdId,
  category,
  onDone,
}: {
  householdId: string | null;
  category: Category | null;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { showToast } = useToast();
  const createCategory = useCreateCategory(householdId);
  const updateCategory = useUpdateCategory(householdId);

  const [name, setName] = useState(category?.name ?? '');
  const [fields, setFields] = useState<CategoryFieldSchema[]>(category?.metadataSchema ?? []);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CategoryFieldType>('string');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = createCategory.isPending || updateCategory.isPending;

  const addField = () => {
    const key = sanitizeKey(newFieldLabel);
    if (!newFieldLabel.trim() || !key) return;
    if (fields.some((field) => field.key === key)) {
      setError('Un champ avec une clé équivalente existe déjà.');
      return;
    }
    setFields((current) => [
      ...current,
      { key, label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired },
    ]);
    setNewFieldLabel('');
    setNewFieldType('string');
    setNewFieldRequired(false);
    setError(null);
  };

  const removeField = (key: string) => {
    setFields((current) => current.filter((field) => field.key !== key));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    setError(null);
    try {
      if (category) {
        await updateCategory.mutateAsync({
          categoryId: category.id,
          input: { name: name.trim(), metadataSchema: fields },
        });
        showToast('Catégorie modifiée.', 'success');
      } else {
        await createCategory.mutateAsync({ name: name.trim(), metadataSchema: fields });
        showToast('Catégorie créée.', 'success');
      }
      onDone();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: theme.spacing.lg }}>
        <AppText variant="title">
          {category ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        </AppText>

        <TextField label="Nom" value={name} onChangeText={setName} maxLength={60} />

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="section">Champs personnalisés</AppText>
          {fields.length === 0 ? (
            <AppText variant="body" color="textMuted">
              Aucun champ pour l’instant.
            </AppText>
          ) : (
            fields.map((field) => (
              <View
                key={field.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: theme.spacing.xs,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
              >
                <AppText variant="body">
                  {field.label} ({FIELD_TYPE_OPTIONS.find((o) => o.value === field.type)?.label}
                  {field.required ? ', requis' : ''})
                </AppText>
                <IconButton
                  name="close-outline"
                  accessibilityLabel={`Retirer le champ ${field.label}`}
                  onPress={() => removeField(field.key)}
                />
              </View>
            ))
          )}

          <View
            style={{
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <TextField
              label="Libellé du champ"
              value={newFieldLabel}
              onChangeText={setNewFieldLabel}
            />
            <Select
              label="Type"
              value={newFieldType}
              onChange={(value) => value && setNewFieldType(value)}
              allowClear={false}
              options={FIELD_TYPE_OPTIONS}
            />
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              <Chip
                label="Requis"
                selected={newFieldRequired}
                onPress={() => setNewFieldRequired((v) => !v)}
              />
            </View>
            <Button label="Ajouter ce champ" variant="ghost" onPress={addField} />
          </View>
        </View>

        {error ? (
          <AppText variant="helper" color="danger">
            {error}
          </AppText>
        ) : null}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="Annuler"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={onDone}
            disabled={isBusy}
          />
          <Button
            label={category ? 'Enregistrer' : 'Créer'}
            style={{ flex: 1 }}
            onPress={() => void handleSubmit()}
            loading={isBusy}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}
