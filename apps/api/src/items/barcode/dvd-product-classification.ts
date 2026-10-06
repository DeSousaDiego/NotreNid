import type { DvdMediaType } from './types/dvd-poc.types';

/**
 * Classification d'un produit physique pour la catégorie `dvd` — fonctions
 * pures, indépendantes du fournisseur produit (UPCitemdb, Digit-Eyes). Extraites
 * de `UpcItemDbProvider` pour être partagées par tous les `DvdProductProvider`
 * et par le nettoyage de titre TMDB (`cleanTitleForSearch`), sans qu'aucun ne
 * dépende d'un autre fournisseur. Comportement strictement identique à la
 * version d'origine — voir docs/DECISIONS.md.
 */

const DVD_KEYWORD = /\bdvd\b/i;
const BLURAY_KEYWORD = /\bblu[-\s]?ray\b/i;

/**
 * Détermine le FORMAT uniquement à partir d'un mot-clé explicite
 * ("DVD"/"Blu-ray") dans le texte fourni (titre/description/format du
 * fournisseur) — jamais depuis des catégories (voir `hasVideoCategory`). Un
 * item contenant les deux mots-clés (ex. combo pack "DVD + 2-Disc Blu-ray",
 * observé réellement) est classé `'dvd'` : il contient bien un disque DVD,
 * cohérent avec la catégorie `dvd` de Notre Nid (qui ne distingue pas encore
 * Blu-ray). Ne renvoie jamais `'video'` : ce niveau "vidéo confirmée, format
 * inconnu" ne peut venir que des catégories, décision du provider.
 */
export function detectMediaType(text: string): DvdMediaType {
  if (DVD_KEYWORD.test(text)) return 'dvd';
  if (BLURAY_KEYWORD.test(text)) return 'bluray';
  return 'unknown';
}

// Motifs les plus spécifiques en premier : "Ultimate Collector's Edition"
// doit être capturé en entier, jamais tronqué à "Collector's Edition" parce
// que ce dernier motif aurait matché avant.
const EDITION_PATTERNS: RegExp[] = [
  /Ultimate Collector'?s Edition/i,
  /Extended Collector'?s Edition/i,
  /Collector'?s Edition/i,
  /Director'?s Cut/i,
  /Extended Edition/i,
  /Special Edition/i,
  /Anniversary Edition/i,
  /Unrated Edition/i,
  /Theatrical Edition/i,
];

export function detectEditionHint(text: string): string | null {
  for (const pattern of EDITION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

// Vocabulaire standard (Region 1-6, A/B/C, Free), sans risque de faux positif
// — observé réellement chez Digit-Eyes ("[region 1]"), jamais chez UPCitemdb
// sur les échantillons testés (voir docs/DECISIONS.md).
const REGION_PATTERN = /\bRegion[-\s]?(?:Free|[ABC]|[0-6])\b/i;

export function detectRegionHint(text: string): string | null {
  const match = REGION_PATTERN.exec(text);
  return match ? match[0] : null;
}

const DISC_COUNT_PATTERN = /\b(?:\d+|One|Two|Three|Four|Five|Six|Seven|Eight)[-\s]Discs?\b/i;
const BOX_SET_PATTERN = /\bbox\s?set\b/i;

export function detectPackagingHint(text: string): string | null {
  const discMatch = DISC_COUNT_PATTERN.exec(text);
  if (discMatch) return discMatch[0];
  const boxMatch = BOX_SET_PATTERN.exec(text);
  return boxMatch ? boxMatch[0] : null;
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Liste blanche d'entrées de catégorie réellement observées sur des
 * DVD/Blu-ray chez Digit-Eyes (POC du 2026-10-06, voir docs/DECISIONS.md),
 * comparées par ÉGALITÉ EXACTE après normalisation (casse/espaces) — jamais
 * par sous-chaîne : "Movie Theater Popcorn" ou "DVD Shaped Cookies" ne doivent
 * jamais suffire. Absente de la liste = aucun signal (jamais un rejet actif).
 * Volontairement SANS les libellés de rayon nus ("Movies", "DVD", "Blu-ray",
 * "Blu-ray HD DVD") : ils étiquettent aussi des lecteurs, rangements, supports
 * vierges ou produits dérivés. Chaque DVD/Blu-ray du POC porte au moins une
 * entrée plus spécifique ci-dessous.
 */
const VIDEO_CATEGORIES: ReadonlySet<string> = new Set(
  [
    'Movies & TV',
    'Movies & TV Shows',
    'Movie Series',
    'DVD Movies',
    'Blu-ray Movies',
    'Batman Movies',
    'Disney Movies',
  ].map(normalizeCategory),
);

/**
 * Signal "vidéo OUI/NON" uniquement — jamais le format : la catégorie
 * générique "Blu-ray HD DVD" apparaît sur des Blu-ray purs (observé), un
 * `detectMediaType` appliqué aux catégories classerait donc à tort ces
 * produits en `'dvd'`. Le format reste l'affaire de `detectMediaType` sur le
 * texte propre du produit.
 */
export function hasVideoCategory(categories: readonly string[]): boolean {
  return categories.some((category) => VIDEO_CATEGORIES.has(normalizeCategory(category)));
}
