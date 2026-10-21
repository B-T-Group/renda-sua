/** Vitest stub — expo-crypto is not available in Node test env. */
export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA-256',
  MD5 = 'MD5',
}

export async function digestStringAsync(
  _algorithm: string,
  data: string
): Promise<string> {
  // Deterministic hex stub for unit tests.
  let h = 0;
  for (let i = 0; i < data.length; i++) {
    h = (Math.imul(31, h) + data.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(64, '0');
}

export default { CryptoDigestAlgorithm, digestStringAsync };
