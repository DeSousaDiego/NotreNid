import { randomInt } from 'node:crypto';

/**
 * Duplique volontairement l'alphabet de `packages/shared/src/invitation-code.ts` (mêmes
 * raisons que `iso-country-codes.constant.ts` : l'API ne dépend d'aucun package du
 * monorepo en runtime). La normalisation/le format restent identiques des deux côtés —
 * seule cette génération cryptographique est spécifique à l'API.
 */
export const INVITATION_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const INVITATION_CODE_LENGTH = 8;

const CODE_FORMAT = new RegExp(`^[${INVITATION_CODE_ALPHABET}]{${INVITATION_CODE_LENGTH}}$`);

/**
 * Génère un code par tirage cryptographiquement sûr (`crypto.randomInt`, à échantillonnage
 * uniforme — pas de biais modulo) : 8 caractères pris dans un alphabet de 31 symboles, soit
 * environ 39,6 bits d'entropie (log2(31^8)). Suffisant pour un secret à courte durée de vie
 * (7 jours), à usage unique, et dont l'endpoint de vérification est limité en débit — voir
 * docs/DECISIONS.md pour l'analyse complète.
 */
export function generateInvitationCode(): string {
  let code = '';
  for (let i = 0; i < INVITATION_CODE_LENGTH; i++) {
    code += INVITATION_CODE_ALPHABET[randomInt(INVITATION_CODE_ALPHABET.length)];
  }
  return code;
}

/** Miroir de `packages/shared/src/invitation-code.ts` — voir ce fichier pour les commentaires. */
export function normalizeInvitationCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^NID-?/, '')
    .replace(/[\s-]/g, '');
}

export function isValidInvitationCodeFormat(raw: string): boolean {
  return CODE_FORMAT.test(raw);
}
