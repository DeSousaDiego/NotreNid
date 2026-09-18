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
  numeric?: boolean;
}

export const BOOK_FIELDS: MetadataFieldConfig[] = [
  { key: 'author', label: 'Auteur' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'publisher', label: 'Éditeur' },
  { key: 'publicationYear', label: 'Année de publication', numeric: true },
  { key: 'language', label: 'Langue' },
  { key: 'pageCount', label: 'Nombre de pages', numeric: true },
  { key: 'format', label: 'Format' },
];

export const CD_FIELDS: MetadataFieldConfig[] = [
  { key: 'artist', label: 'Artiste' },
  { key: 'releaseYear', label: 'Année de sortie', numeric: true },
  { key: 'label', label: 'Label' },
  { key: 'format', label: 'Format' },
];

export const DVD_FIELDS: MetadataFieldConfig[] = [
  { key: 'director', label: 'Réalisateur' },
  { key: 'releaseYear', label: 'Année de sortie', numeric: true },
  { key: 'edition', label: 'Édition' },
  { key: 'region', label: 'Région' },
  { key: 'format', label: 'Format' },
  { key: 'durationMinutes', label: 'Durée (minutes)', numeric: true },
];

export function metadataFieldsForSlug(slug: string): MetadataFieldConfig[] | null {
  if (slug === 'book') return BOOK_FIELDS;
  if (slug === 'cd') return CD_FIELDS;
  if (slug === 'dvd') return DVD_FIELDS;
  return null;
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
