/** Jest/Vitest stub — native Expo modules are unavailable in Node test env. */
export function requireNativeModule(_name: string): Record<string, unknown> {
  return {};
}

export function requireOptionalNativeModule(_name: string): null {
  return null;
}

export const NativeModulesProxy: Record<string, unknown> = {};

export class EventEmitter {
  addListener() {
    return { remove: () => undefined };
  }
  removeListener() {
    return undefined;
  }
}

export default {
  requireNativeModule,
  requireOptionalNativeModule,
  NativeModulesProxy,
  EventEmitter,
};
