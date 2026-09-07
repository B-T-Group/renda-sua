/** Vitest stub — expo-secure-store is not available in Node test env. */
const store: Record<string, string> = {};

export async function getItemAsync(key: string): Promise<string | null> {
  return store[key] ?? null;
}

export async function setItemAsync(key: string, value: string, _options?: object): Promise<void> {
  store[key] = value;
}

export async function deleteItemAsync(key: string): Promise<void> {
  delete store[key];
}

export function isAvailableAsync(): Promise<boolean> {
  return Promise.resolve(true);
}

export default { getItemAsync, setItemAsync, deleteItemAsync, isAvailableAsync };
