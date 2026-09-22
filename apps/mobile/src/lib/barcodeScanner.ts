import type { BarcodeType } from 'expo-camera';

/**
 * Formats produit pertinents pour livres/CD/DVD (voir `ResolveBarcodeDto`
 * côté API : EAN-8, UPC-A ou EAN-13 uniquement). QR/DataMatrix/etc. ne sont
 * jamais activés — aucun de nos fournisseurs ne les exploite.
 */
export const SUPPORTED_BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

/**
 * Nettoie un code détecté par la caméra (ou saisi) avant l'appel à
 * `resolveBarcode` : espaces superflus retirés, caractères non numériques
 * supprimés. Ne fait *jamais* d'aller-retour par `Number`/`parseInt` — cela
 * tronquerait un zéro initial (ex. un UPC-A `012345678905` deviendrait
 * `12345678905`), qui fait partie intégrante du code. `ResolveBarcodeDto`
 * (apps/api) reste seul responsable de valider la longueur finale (8, 12 ou
 * 13 chiffres) ; un code plus court/long après nettoyage (mauvaise
 * détection) est tout de même transmis tel quel, l'API renverra une erreur
 * de validation explicite plutôt qu'un rejet silencieux ici.
 */
export function normalizeScannedBarcode(raw: string): string {
  return raw.trim().replace(/\D/g, '');
}
