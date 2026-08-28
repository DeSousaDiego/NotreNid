/**
 * Notes autorisées pour `Item.rating` : demi-étoiles de 0,5 à 5 (voir schema.prisma).
 * `@IsIn` valide par égalité stricte sur cette liste — pas de comparaison flottante
 * approximative (voir docs/DECISIONS.md pour le choix de représentation).
 */
export const ITEM_RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;

export type ItemRatingValue = (typeof ITEM_RATING_VALUES)[number];
