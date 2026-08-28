import type { CreateItemInput, UpdateItemInput } from '@notre-nid/api-client';
import {
  ITEM_CONDITIONS,
  ITEM_RATING_VALUES,
  type Category,
  type Item,
  type ItemRating,
} from '@notre-nid/shared';
import { z } from 'zod';

const RATING_VALUES_SET: readonly number[] = ITEM_RATING_VALUES;

/**
 * Toutes les métadonnées sont conservées comme chaînes de caractères dans le
 * formulaire (adapté aux `TextField`) — la conversion vers les types réels
 * attendus par l'API (nombres, booléens) se fait uniquement à la soumission,
 * via `buildItemPayload`. Cela évite d'avoir un schéma Zod différent par
 * catégorie tout en gardant la validation du formulaire simple.
 */
const metadataGroupSchema = z.object({
  author: z.string().optional(),
  isbn: z.string().optional(),
  publisher: z.string().optional(),
  publicationYear: z.string().optional(),
  language: z.string().optional(),
  pageCount: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  releaseYear: z.string().optional(),
  label: z.string().optional(),
  format: z.string().optional(),
  director: z.string().optional(),
  edition: z.string().optional(),
  region: z.string().optional(),
  durationMinutes: z.string().optional(),
});

export const itemFormSchema = z.object({
  categoryId: z.string().min(1, 'Choisissez une catégorie.'),
  title: z.string().min(1, 'Le titre est requis.').max(200, 'Le titre est trop long.'),
  condition: z.enum(ITEM_CONDITIONS, { message: 'Choisissez un état.' }),
  rating: z
    .number()
    .refine((value) => RATING_VALUES_SET.includes(value), { message: 'Note invalide.' })
    .nullable()
    .optional(),
  description: z.string().max(2000, 'La description est trop longue.').optional(),
  notes: z.string().max(2000, 'Les notes sont trop longues.').optional(),
  ownerIds: z.array(z.string()).min(1, 'Sélectionnez au moins un propriétaire.'),
  coverImageUrl: z.string().optional(),
  metadata: metadataGroupSchema,
  customMetadata: z.record(z.string(), z.string()),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const EMPTY_ITEM_FORM_VALUES: ItemFormValues = {
  categoryId: '',
  title: '',
  condition: 'GOOD',
  rating: null,
  description: '',
  notes: '',
  ownerIds: [],
  coverImageUrl: '',
  metadata: {},
  customMetadata: {},
};

/** Construit les valeurs initiales du formulaire à partir d'un item existant (mode édition). */
export function itemToFormValues(item: Item): ItemFormValues {
  const metadata: ItemFormValues['metadata'] = {};
  if (item.book) {
    metadata.author = item.book.author ?? '';
    metadata.isbn = item.book.isbn ?? '';
    metadata.publisher = item.book.publisher ?? '';
    metadata.publicationYear = item.book.publicationYear?.toString() ?? '';
    metadata.language = item.book.language ?? '';
    metadata.pageCount = item.book.pageCount?.toString() ?? '';
  } else if (item.cd) {
    metadata.artist = item.cd.artist ?? '';
    metadata.album = item.cd.album ?? '';
    metadata.releaseYear = item.cd.releaseYear?.toString() ?? '';
    metadata.label = item.cd.label ?? '';
    metadata.format = item.cd.format ?? '';
  } else if (item.dvd) {
    metadata.director = item.dvd.director ?? '';
    metadata.releaseYear = item.dvd.releaseYear?.toString() ?? '';
    metadata.edition = item.dvd.edition ?? '';
    metadata.region = item.dvd.region ?? '';
    metadata.format = item.dvd.format ?? '';
    metadata.durationMinutes = item.dvd.durationMinutes?.toString() ?? '';
  }

  const customMetadata: Record<string, string> = {};
  if (item.customMetadata) {
    for (const [key, value] of Object.entries(item.customMetadata)) {
      customMetadata[key] = String(value);
    }
  }

  return {
    categoryId: item.category.id,
    title: item.title,
    condition: item.condition,
    rating: item.rating,
    description: item.description ?? '',
    notes: item.notes ?? '',
    ownerIds: item.owners.map((owner) => owner.id),
    coverImageUrl: item.coverImageUrl ?? '',
    metadata,
    customMetadata,
  };
}

function toOptionalInt(value: string | undefined): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildCustomMetadataPayload(
  category: Category,
  raw: Record<string, string>,
): Record<string, unknown> {
  const schema = category.metadataSchema ?? [];
  const payload: Record<string, unknown> = {};
  for (const field of schema) {
    const value = raw[field.key];
    if (value === undefined || value.trim() === '') continue;
    if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) payload[field.key] = parsed;
    } else if (field.type === 'boolean') {
      payload[field.key] = value === 'true';
    } else {
      payload[field.key] = value;
    }
  }
  return payload;
}

/** Traduit les valeurs (chaînes) du formulaire vers le payload typé attendu par l'API. */
export function buildItemPayload(values: ItemFormValues, category: Category): CreateItemInput {
  const payload: CreateItemInput = {
    categoryId: values.categoryId,
    title: values.title.trim(),
    condition: values.condition,
    // `.refine` valide déjà que la valeur appartient à ITEM_RATING_VALUES ; Zod ne
    // dérive pas un type littéral d'un `.refine` sur `z.number()` comme il le fait
    // pour `z.enum` (condition ci-dessus), d'où cette assertion ponctuelle.
    rating: (values.rating ?? undefined) as ItemRating | undefined,
    description: toOptionalString(values.description),
    notes: toOptionalString(values.notes),
    ownerIds: values.ownerIds,
    coverImageUrl: toOptionalString(values.coverImageUrl),
  };

  if (category.slug === 'book') {
    payload.book = {
      author: toOptionalString(values.metadata.author),
      isbn: toOptionalString(values.metadata.isbn),
      publisher: toOptionalString(values.metadata.publisher),
      publicationYear: toOptionalInt(values.metadata.publicationYear),
      language: toOptionalString(values.metadata.language),
      pageCount: toOptionalInt(values.metadata.pageCount),
    };
  } else if (category.slug === 'cd') {
    payload.cd = {
      artist: toOptionalString(values.metadata.artist),
      album: toOptionalString(values.metadata.album),
      releaseYear: toOptionalInt(values.metadata.releaseYear),
      label: toOptionalString(values.metadata.label),
      format: toOptionalString(values.metadata.format),
    };
  } else if (category.slug === 'dvd') {
    payload.dvd = {
      director: toOptionalString(values.metadata.director),
      releaseYear: toOptionalInt(values.metadata.releaseYear),
      edition: toOptionalString(values.metadata.edition),
      region: toOptionalString(values.metadata.region),
      format: toOptionalString(values.metadata.format),
      durationMinutes: toOptionalInt(values.metadata.durationMinutes),
    };
  } else if (!category.isSystem) {
    payload.customMetadata = buildCustomMetadataPayload(category, values.customMetadata);
  }

  return payload;
}

export function buildItemUpdatePayload(
  values: ItemFormValues,
  category: Category,
): UpdateItemInput {
  return buildItemPayload(values, category);
}

/** Champs personnalisés requis (catégorie personnalisée) manquants ou vides. */
export function findMissingRequiredCustomFields(
  category: Category | undefined,
  raw: Record<string, string>,
): string[] {
  if (!category || category.isSystem) return [];
  const schema = category.metadataSchema ?? [];
  return schema
    .filter((field) => field.required && !raw[field.key]?.trim())
    .map((field) => field.label);
}
