import { useEffect, useState } from 'react';
import {
  getEffectiveEnv,
  registerEnvChangeListener,
  type EnvName,
} from '../config/envSwitch';

/** Reactive effective API environment (`prod` when unset). */
export function useRuntimeEnv(): EnvName {
  const [env, setEnv] = useState<EnvName>(() => getEffectiveEnv());

  useEffect(() => {
    return registerEnvChangeListener(() => {
      setEnv(getEffectiveEnv());
    });
  }, []);

  return env;
}
