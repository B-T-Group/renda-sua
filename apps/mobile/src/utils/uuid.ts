/**
 * Generate a RFC4122 v4 UUID.
 * Uses expo-crypto's randomUUID() if available, otherwise falls back to a pure JS implementation.
 */

let randomUUID: () => string;

try {
  // Try to use expo-crypto (runtime only, not in tests)
  randomUUID = require('expo-crypto').randomUUID;
} catch {
  // Fallback for test environment: RFC4122 v4 UUID generator
  randomUUID = (): string => {
    // Use crypto.getRandomValues if available, otherwise Math.random
    const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    const getRandomValues = (
      globalCrypto && globalCrypto.getRandomValues
        ? (arr: Uint8Array) => globalCrypto.getRandomValues(arr)
        : (arr: Uint8Array) => {
            for (let i = 0; i < arr.length; i++) {
              arr[i] = Math.floor(Math.random() * 256);
            }
            return arr;
          }
    );

    const bytes = new Uint8Array(16);
    getRandomValues(bytes);

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

    const hex = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  };
}

export { randomUUID };
