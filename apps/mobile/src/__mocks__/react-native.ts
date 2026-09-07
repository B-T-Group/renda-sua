/** Vitest stub — react-native cannot be parsed by Rollup in Node test env. */
export const Platform = {
  OS: 'ios' as const,
  select: <T>(obj: { ios?: T; android?: T; web?: T; default?: T }): T =>
    (obj.ios ?? obj.default) as T,
};

export const Alert = {
  alert: () => {},
};

export const Vibration = {
  vibrate: () => {},
};

export const AppState = {
  addEventListener: () => ({ remove: () => {} }),
};

export const InteractionManager = {
  runAfterInteractions: (callback?: () => void) => {
    callback?.();
    return { then: (cb?: () => void) => cb?.(), done: () => {}, cancel: () => {} };
  },
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

export const StyleSheet = {
  create: <T extends Record<string, object>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  hairlineWidth: 1,
};

export default {
  Platform,
  Alert,
  Vibration,
  AppState,
  InteractionManager,
  Dimensions,
  StyleSheet,
};
