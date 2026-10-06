import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { DigitEyesProvider } from './digit-eyes.provider';
import type { DvdProductProvider } from './dvd-product-provider.interface';
import type { UpcItemDbProvider } from './upcitemdb.provider';

export const DVD_PRODUCT_PROVIDER_VALUES = ['upcitemdb', 'digiteyes'] as const;

/** Sans valeur explicite : UPCitemdb, le comportement historique — un
 * déploiement sans la variable ne change donc jamais de fournisseur. */
const DEFAULT_PROVIDER = 'upcitemdb';

const logger = new Logger('DvdProductProvider');

/**
 * Choisit le provider produit `dvd` au démarrage selon `DVD_PRODUCT_PROVIDER`.
 * Une valeur inconnue, ou `digiteyes` sans ses identifiants, fait ÉCHOUER le
 * démarrage avec un message explicite plutôt qu'une panne silencieuse au
 * premier scan. Jamais de fallback automatique entre fournisseurs : le
 * rollback est manuel (changer la variable, redémarrer — voir
 * docs/OPERATIONS.md).
 */
export function selectDvdProductProvider(
  configService: ConfigService,
  upcItemDb: UpcItemDbProvider,
  digitEyes: DigitEyesProvider,
): DvdProductProvider {
  const raw = configService.get<string>('DVD_PRODUCT_PROVIDER')?.trim().toLowerCase();
  const selected = raw || DEFAULT_PROVIDER;

  if (selected === 'upcitemdb') {
    logger.log('Provider produit DVD : upcitemdb');
    return upcItemDb;
  }

  if (selected === 'digiteyes') {
    const missing = ['DIGITEYES_APP_KEY', 'DIGITEYES_AUTH_KEY'].filter(
      (key) => !configService.get<string>(key)?.trim(),
    );
    if (missing.length > 0) {
      throw new Error(
        `Configuration invalide : DVD_PRODUCT_PROVIDER=digiteyes exige ${missing.join(' et ')}.`,
      );
    }
    logger.log('Provider produit DVD : digiteyes');
    return digitEyes;
  }

  throw new Error(
    `Configuration invalide : DVD_PRODUCT_PROVIDER="${raw}" — valeurs acceptées : ${DVD_PRODUCT_PROVIDER_VALUES.join(', ')}.`,
  );
}
