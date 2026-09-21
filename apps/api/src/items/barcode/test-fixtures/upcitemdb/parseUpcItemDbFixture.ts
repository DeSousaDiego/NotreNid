import type { RawUpcItemDbResponseFixture } from './types';
import {
  detectEditionHint,
  detectMediaType,
  detectPackagingHint,
  detectRegionHint,
  selectMatchingItem,
  type UpcItemDbLookupOutcome,
} from '../../providers/upcitemdb.provider';
import type { UpcItemDbPocResult } from '../../types/dvd-poc.types';

/**
 * Traduit une fixture brute (même enveloppe qu'une vraie réponse UPCitemdb)
 * en `UpcItemDbLookupOutcome` — TEST-ONLY, jamais importé par le code
 * runtime. Reproduit volontairement la même normalisation que
 * `UpcItemDbProvider` (`normalizeItem` + décision `matched`/`not_video`,
 * privées dans ce fichier), en réutilisant ses fonctions de classification
 * EXPORTÉES (`detectMediaType`/`detectEditionHint`/`detectRegionHint`/
 * `detectPackagingHint`/`selectMatchingItem`) : c'est cette logique réelle
 * qui est sous test, jamais une réimplémentation indépendante — seule la
 * plomberie de mapping champ par champ est dupliquée ici (quelques lignes
 * triviales, sans risque de dérive silencieuse sur le comportement observé).
 */
export function parseUpcItemDbFixture(
  fixture: RawUpcItemDbResponseFixture,
  barcode: string,
): UpcItemDbLookupOutcome {
  if (fixture.code !== 'OK') return { status: 'no_match' };

  const selection = selectMatchingItem(fixture.items, barcode);
  if (selection.kind !== 'found') return { status: 'no_match' };

  const item = selection.item;
  const classificationText = [item.title, item.description].filter(Boolean).join(' ');
  const hintText = [item.title, item.description, ...(item.offers ?? []).map((o) => o.title)]
    .filter((v): v is string => Boolean(v))
    .join(' \n ');

  const result: UpcItemDbPocResult = {
    barcode,
    rawTitle: item.title?.trim() || null,
    description: item.description?.trim() || null,
    brand: item.brand?.trim() || null,
    category: item.category?.trim() || null,
    imageUrl: item.images?.[0] ?? null,
    mediaType: detectMediaType(classificationText),
    editionHint: detectEditionHint(hintText),
    regionHint: detectRegionHint(hintText),
    packagingHint: detectPackagingHint(hintText),
  };

  if (result.mediaType === 'unknown') return { status: 'not_video', result };
  return { status: 'matched', result };
}
