/**
 * Alphabet des codes d'invitation (Bloc 2 — invitation par code, docs/NOTRE_NID_PRD.md).
 * 31 symboles : chiffres et lettres majuscules, à l'exclusion de 0/O, 1/I/L — visuellement
 * ambigus à l'oral comme à l'écrit. Insensible à la casse (normalisé en majuscules).
 */
export const INVITATION_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** 8 caractères ≈ 39,6 bits d'entropie (log2(31^8)) — voir apps/api pour la génération. */
export const INVITATION_CODE_LENGTH = 8;

const CODE_FORMAT = new RegExp(`^[${INVITATION_CODE_ALPHABET}]{${INVITATION_CODE_LENGTH}}$`);

/**
 * Normalise une saisie utilisateur avant comparaison/envoi à l'API : retire un éventuel
 * préfixe de marque « NID- », les séparateurs et espaces, met en majuscules. Idempotent
 * (peut être appliqué à chaque frappe pour formater l'affichage en temps réel).
 */
export function normalizeInvitationCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^NID-?/, '')
    .replace(/[\s-]/g, '');
}

/** Vrai si `raw`, une fois normalisé, correspond exactement au format attendu. */
export function isValidInvitationCodeFormat(raw: string): boolean {
  return CODE_FORMAT.test(normalizeInvitationCode(raw));
}

/** Formate un code normalisé pour l'affichage/le partage : `XXXX-XXXX`. */
export function formatInvitationCode(normalizedCode: string): string {
  return normalizedCode.match(/.{1,4}/g)?.join('-') ?? normalizedCode;
}
