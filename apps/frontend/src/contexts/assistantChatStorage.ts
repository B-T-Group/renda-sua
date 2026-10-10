/**
 * sessionStorage keys for the assistant chat. Kept in their own module so
 * SessionAuthContext can clear them on logout without importing the chat
 * provider (which itself depends on SessionAuthContext).
 */
export const STORAGE_KEY_MESSAGES = 'rendasua.assistant.chat.v1';
export const STORAGE_KEY_THREAD_ID = 'rendasua.assistant.thread_id.v1';
export const STORAGE_KEY_LAST_ACTIVITY = 'rendasua.assistant.last_activity.v1';
/** Owner of the stored thread: `guest` or `u:<hash of user.sub>`. Never the raw sub. */
export const STORAGE_KEY_OWNER = 'rendasua.assistant.owner.v1';
/** Set while a send has not received its reply, so a remount can offer Retry. */
export const STORAGE_KEY_PENDING = 'rendasua.assistant.pending.v1';

export const ASSISTANT_CHAT_STORAGE_KEYS = [
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_THREAD_ID,
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_OWNER,
  STORAGE_KEY_PENDING,
] as const;

/** False when storage throws or a write fails, until a later write succeeds. */
let storageUsable = true;

export function assistantStorageUsable(): boolean {
  return storageUsable;
}

function sessionStore(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage;
  } catch {
    storageUsable = false;
    return null;
  }
}

export function readAssistantStorage(key: string): string | null {
  const store = sessionStore();
  if (!store) {
    storageUsable = false;
    return null;
  }
  try {
    return store.getItem(key);
  } catch {
    storageUsable = false;
    return null;
  }
}

export function writeAssistantStorage(key: string, value: string): boolean {
  const store = sessionStore();
  if (!store) {
    storageUsable = false;
    return false;
  }
  try {
    store.setItem(key, value);
    storageUsable = true;
    return true;
  } catch {
    storageUsable = false;
    return false;
  }
}

export function removeAssistantStorage(key: string): void {
  const store = sessionStore();
  if (!store) {
    storageUsable = false;
    return;
  }
  try {
    store.removeItem(key);
  } catch {
    storageUsable = false;
  }
}

/** Removes every assistant chat key. Called on logout. */
export function clearAssistantChatStorage(): void {
  for (const key of ASSISTANT_CHAT_STORAGE_KEYS) {
    removeAssistantStorage(key);
  }
}
