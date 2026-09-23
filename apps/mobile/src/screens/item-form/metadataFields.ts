import type { BookMetadata, CdMetadata, DvdMetadata } from '@notre-nid/shared';

export interface MetadataFieldConfig {
  key:
    | 'author'
    | 'isbn'
    | 'publisher'
    | 'publicationYear'
    | 'language'
    | 'pageCount'
    | 'artist'
    | 'releaseYear'
    | 'label'
    | 'format'
    | 'director'
    | 'edition'
    | 'region'
    | 'durationMinutes';
  label: string;
  /**
   * Libellé de la fiche détail, si différent de `label` (champ du formulaire) —
   * les deux écrans affichaient déjà des libellés distincts pour ces 3 champs
   * avant ce refactor (« Année », « Pages », « Durée », plus courts) ; ce lot
   * unifie la source (champs + ordre + valeurs) sans changer un texte déjà
   * affiché à l'utilisateur. Repli sur `label` si absent.
   */
  detailLabel?: string;
  numeric?: boolean;
  /**
   * Formatte la valeur brute pour un AFFICHAGE en lecture seule (fiche détail) —
   * jamais consulté par le formulaire (édition de la valeur brute telle quelle,
   * voir `StepInformation.tsx`). Repli sur la valeur telle quelle si absent : ce
   * lot ne traduit délibérément que ce qui l'était déjà (format livre, durée DVD),
   * jamais les formats CD/DVD (voir docs/DECISIONS.md).
   */
  formatDisplayValue?: (rawValue: string) => string;
}

export const BOOK_FIELDS: MetadataFieldConfig[] = [
  { key: 'author', label: 'Auteur' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'publisher', label: 'Éditeur' },
  { key: 'publicationYear', label: 'Année de publication', detailLabel: 'Année', numeric: true },
  { key: 'language', label: 'Langue' },
  { key: 'pageCount', label: 'Nombre de pages', detailLabel: 'Pages', numeric: true },
  { key: 'format', label: 'Format', formatDisplayValue: formatBookFormatLabel },
];

export const CD_FIELDS: MetadataFieldConfig[] = [
  { key: 'artist', label: 'Artiste' },
  { key: 'releaseYear', label: 'Année de sortie', detailLabel: 'Année', numeric: true },
  { key: 'label', label: 'Label' },
  { key: 'format', label: 'Format' },
];

export const DVD_FIELDS: MetadataFieldConfig[] = [
  { key: 'director', label: 'Réalisateur' },
  { key: 'releaseYear', label: 'Année de sortie', detailLabel: 'Année', numeric: true },
  { key: 'edition', label: 'Édition' },
  { key: 'region', label: 'Région' },
  { key: 'format', label: 'Format' },
  {
    key: 'durationMinutes',
    label: 'Durée (minutes)',
    detailLabel: 'Durée',
    numeric: true,
    formatDisplayValue: (value) => `${value} min`,
  },
];

export function metadataFieldsForSlug(slug: string): MetadataFieldConfig[] | null {
  if (slug === 'book') return BOOK_FIELDS;
  if (slug === 'cd') return CD_FIELDS;
  if (slug === 'dvd') return DVD_FIELDS;
  return null;
}

export interface MetadataDisplayRow {
  label: string;
  value: string;
}

/**
 * Source unique pour la fiche détail (`collection/[itemId].tsx`) : mêmes champs et
 * même ORDRE que le formulaire (`BOOK_FIELDS`/`CD_FIELDS`/`DVD_FIELDS` ci-dessus),
 * libellé identique sauf où `detailLabel` le précise — plus aucune liste dupliquée
 * à maintenir en double. `metadata` est l'objet `BookMetadata`/`CdMetadata`/
 * `DvdMetadata` de l'item ; une valeur absente, `null` ou une chaîne vide n'ajoute
 * simplement aucune ligne (jamais de `—`), même comportement qu'avant ce refactor
 * (les anciens `if (item.book.xxx)` étaient déjà des vérifications de vérité, pas
 * de simples `!= null` — un `pageCount`/`releaseYear` à `0` reste donc, comme avant,
 * silencieusement omis).
 */
export function metadataDisplayRows(
  fields: MetadataFieldConfig[],
  metadata: BookMetadata | CdMetadata | DvdMetadata,
): MetadataDisplayRow[] {
  const rows: MetadataDisplayRow[] = [];
  const record = metadata as unknown as Record<string, unknown>;
  for (const field of fields) {
    const raw = record[field.key];
    if (!raw) continue;
    const rawValue = String(raw);
    rows.push({
      label: field.detailLabel ?? field.label,
      value: field.formatDisplayValue ? field.formatDisplayValue(rawValue) : rawValue,
    });
  }
  return rows;
}

/**
 * Catégories réellement proposées par le flow d'ajout (écran « Choisir une catégorie »,
 * Bloc 2). Volontairement une whitelist explicite plutôt qu'un simple filtre sur
 * `isSystem` : une catégorie système ajoutée côté API avant que son formulaire mobile
 * (config de champs ci-dessus + libellés) n'existe ne doit jamais apparaître comme
 * sélectionnable ici. Étendre = ajouter le slug ici *et* sa config de champs.
 */
export const ADD_ITEM_SUPPORTED_SLUGS = ['book', 'cd', 'dvd'] as const;

/** Libellé du titre d'écran ("Ajouter un livre" / "Ajouter un CD" / "Ajouter un DVD"). */
export function categoryAddTitle(category: { slug: string; name: string }): string {
  if (category.slug === 'book') return 'Ajouter un livre';
  if (category.slug === 'cd') return 'Ajouter un CD';
  if (category.slug === 'dvd') return 'Ajouter un DVD';
  return `Ajouter ${category.name}`;
}

/**
 * Traduction en français lisible du format physique d'un livre (valeur brute
 * d'un fournisseur externe, ex. "Hardcover", ou saisie manuellement) — la
 * valeur stockée en base (`BookMetadata.format`) reste toujours le texte brut,
 * jamais normalisé (voir docs/DECISIONS.md) : cette fonction ne traduit qu'à
 * l'affichage. Repli sur la valeur brute telle quelle si elle n'est pas
 * reconnue — jamais masquée, jamais une traduction incorrecte forcée sur une
 * valeur ambiguë (ex. une reliure spécifique qu'aucune liste ne prévoit).
 */
const BOOK_FORMAT_LABELS_FR: Record<string, string> = {
  hardcover: 'Relié',
  paperback: 'Broché',
  'trade paperback': 'Broché',
  'mass market paperback': 'Poche',
};

export function formatBookFormatLabel(rawFormat: string): string {
  return BOOK_FORMAT_LABELS_FR[rawFormat.trim().toLowerCase()] ?? rawFormat;
}

/**
 * Libellé du champ pays (générique sur `Item`, voir docs/NOTRE_NID_PRD.md — Bloc 1, point
 * 1C), adapté à la catégorie pour rester parlant (ex. « Pays de l'artiste » pour un CD).
 */
export function countryLabelForSlug(slug: string): string {
  if (slug === 'book') return "Pays d'origine";
  if (slug === 'cd') return "Pays de l'artiste";
  if (slug === 'dvd') return 'Pays de production';
  return 'Pays';
}
