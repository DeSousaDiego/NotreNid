import { assertSafeTestEnvironment, buildTestEnvironment } from './test-environment';

// Exécuté par Jest (setupFiles) AVANT l'import d'AppModule dans chaque fichier e2e : si la
// base ciblée n'est pas une base de test locale/autorisée, la suite refuse de démarrer.
const environment = buildTestEnvironment();
assertSafeTestEnvironment('les tests e2e', environment);
Object.assign(process.env, environment);
