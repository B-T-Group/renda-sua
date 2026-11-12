export * from '../../apps/mobile/node_modules/react-native-web/dist/index.js';

export const TurboModuleRegistry = {
  get() {
    return null;
  },
  getEnforcing() {
    return new Proxy(
      {},
      {
        get: () => () => null,
      }
    );
  },
};

export const NativeModules = {};
