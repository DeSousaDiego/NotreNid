const DEFAULT_API_URL = 'http://localhost:3000/api/v1';

/**
 * URL publique de l'API. Sur un appareil physique (Expo Go), `localhost`
 * pointe vers le téléphone lui-même : définir `EXPO_PUBLIC_API_URL` dans
 * `apps/mobile/.env` avec l'adresse IP locale de la machine qui héberge
 * l'API (voir `.env.example`).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL;
