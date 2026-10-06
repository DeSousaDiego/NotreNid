import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import { BarcodeModule } from './barcode.module';
import { DvdBarcodeResolverService } from './dvd-barcode-resolver.service';
import {
  DVD_PRODUCT_PROVIDER,
  type DvdProductProvider,
} from './providers/dvd-product-provider.interface';

/** Câblage Nest réel (jeton + factory) — sans base de données ni réseau :
 * vérifie que `DvdBarcodeResolverService` reçoit bien le provider choisi par
 * `DVD_PRODUCT_PROVIDER`, et qu'une configuration invalide bloque le
 * démarrage. */
async function compileWith(env: Record<string, string>) {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => env],
      }),
      JwtModule.register({ global: true }),
      BarcodeModule,
    ],
  }).compile();
}

describe('BarcodeModule — DVD product provider wiring', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('injects UPCitemdb by default (variable unset)', async () => {
    const moduleRef = await compileWith({});
    expect(moduleRef.get<DvdProductProvider>(DVD_PRODUCT_PROVIDER).id).toBe('upcitemdb');
    expect(moduleRef.get(DvdBarcodeResolverService)).toBeInstanceOf(DvdBarcodeResolverService);
  });

  it('injects Digit-Eyes when DVD_PRODUCT_PROVIDER=digiteyes with its credentials', async () => {
    const moduleRef = await compileWith({
      DVD_PRODUCT_PROVIDER: 'digiteyes',
      DIGITEYES_APP_KEY: 'test-app',
      DIGITEYES_AUTH_KEY: 'test-auth',
    });
    expect(moduleRef.get<DvdProductProvider>(DVD_PRODUCT_PROVIDER).id).toBe('digiteyes');
  });

  it('refuses to start with an unknown provider value', async () => {
    await expect(compileWith({ DVD_PRODUCT_PROVIDER: 'go-upc' })).rejects.toThrow(
      /Configuration invalide/,
    );
  });
});
