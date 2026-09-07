/**
 * Choix manuel de l’environnement – un seul endroit pour forcer dev ou prod.
 * Pas besoin de variables d’environnement (.env).
 *
 * Valeurs possibles :
 *   - null  : automatique (prod par défaut ; dev/local via choix persisté)
 *   - 'dev' : API dev + Auth0 dev (rendasua.ca.auth0.com)
 *   - 'prod': API prod + Auth0 prod (rendasua-prod.ca.auth0.com)
 *   - 'local': localhost API + Auth0 dev
 *
 * Le basculement se fait dans Developer Options (About → 7 taps sur la version).
 * Le choix est persisté (AsyncStorage) et appliqué au prochain démarrage.
 *
 * Surcharge API sans changer d’« env » : variable `EXPO_PUBLIC_API_URL` (voir `getEnv()` dans auth0.ts).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EnvName = 'dev' | 'prod' | 'local';

export const MANUAL_ENV: EnvName | null = null;

/** Clé AsyncStorage pour le choix d’environnement. */
export const ENV_STORAGE_KEY = '@RendasuaAgent:envOverride';

/** Clé AsyncStorage : Developer Options déverrouillé (7 taps sur la version). */
export const DEV_OPTIONS_UNLOCK_KEY = '@RendasuaAgent:developerOptionsUnlocked';

/** Override runtime. Prioritaire sur MANUAL_ENV. */
let _runtimeEnv: EnvName | null = null;

const envChangeListeners = new Set<() => void>();

/** Called when dev/prod/local is switched (Developer Options or hydrate). */
export function registerEnvChangeListener(listener: () => void): () => void {
  envChangeListeners.add(listener);
  return () => envChangeListeners.delete(listener);
}

export function getRuntimeEnv(): EnvName | null {
  return _runtimeEnv;
}

/** Effective env used by API clients (`prod` when unset). */
export function getEffectiveEnv(): EnvName {
  return _runtimeEnv ?? 'prod';
}

export function isNonProdEnv(env: EnvName = getEffectiveEnv()): boolean {
  return env === 'dev' || env === 'local';
}

export function setRuntimeEnv(env: EnvName): void {
  if (_runtimeEnv === env) return;
  _runtimeEnv = env;
  envChangeListeners.forEach((listener) => listener());
}

/** Apply and persist environment for subsequent launches. */
export async function persistRuntimeEnv(env: EnvName): Promise<void> {
  setRuntimeEnv(env);
  await AsyncStorage.setItem(ENV_STORAGE_KEY, env);
}
