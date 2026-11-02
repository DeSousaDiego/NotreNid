import express from 'express';
import request from 'supertest';

import { applyTrustProxy, resolveTrustProxyHops } from './trust-proxy';

function appWithHops(hops: number) {
  const app = express();
  applyTrustProxy(app, hops);
  app.get('/ip', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('trust proxy', () => {
  describe('resolveTrustProxyHops', () => {
    it('defaults to 1 hop in production and to disabled elsewhere', () => {
      expect(resolveTrustProxyHops(undefined, 'production')).toBe(1);
      expect(resolveTrustProxyHops('', 'production')).toBe(1);
      expect(resolveTrustProxyHops(undefined, 'development')).toBe(0);
      expect(resolveTrustProxyHops(undefined, undefined)).toBe(0);
    });

    it('accepts an explicit hop count, including 0 to disable in production', () => {
      expect(resolveTrustProxyHops('2', 'production')).toBe(2);
      expect(resolveTrustProxyHops('0', 'production')).toBe(0);
      expect(resolveTrustProxyHops(3, 'development')).toBe(3);
    });

    it.each(['true', 'abc', '-1', '1.5', '6'])(
      'rejects %p instead of trusting blindly',
      (value) => {
        expect(() => resolveTrustProxyHops(value, 'production')).toThrow(/TRUST_PROXY_HOPS/);
      },
    );
  });

  describe('client address seen by the rate limiter (req.ip)', () => {
    it('ignores X-Forwarded-For entirely when disabled', async () => {
      const response = await request(appWithHops(0))
        .get('/ip')
        .set('X-Forwarded-For', '203.0.113.7');
      expect(response.body.ip).not.toBe('203.0.113.7');
    });

    it('uses the entry appended by our single trusted proxy, never the spoofable left-most one', async () => {
      // Client malveillant : envoie lui-même « 198.51.100.1 » ; le proxy ajoute l'IP réelle.
      const response = await request(appWithHops(1))
        .get('/ip')
        .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7');
      expect(response.body.ip).toBe('203.0.113.7');
    });

    it('walks back exactly N entries when N proxies are trusted', async () => {
      const response = await request(appWithHops(2))
        .get('/ip')
        .set('X-Forwarded-For', '198.51.100.1, 203.0.113.7, 10.0.0.2');
      expect(response.body.ip).toBe('203.0.113.7');
    });
  });
});
