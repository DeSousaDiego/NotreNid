export interface MetadataFieldConfig {
  key:
    | 'author'
    | 'isbn'
    | 'publisher'
    | 'publicationYear'
    | 'language'
    | 'pageCount'
    | 'artist'
    | 'album'
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
];

export const CD_FIELDS: MetadataFieldConfig[] = [
  { key: 'artist', label: 'Artiste' },
  { key: 'album', label: 'Album' },
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
