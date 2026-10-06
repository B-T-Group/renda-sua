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

export const ASSISTANT_CHAT_STORAGE_KEYS = [
  STORAGE_KEY_MESSAGES,
  STORAGE_KEY_THREAD_ID,
  STORAGE_KEY_LAST_ACTIVITY,
  STORAGE_KEY_OWNER,
] as const;

/** Removes every assistant chat key (messages, thread id, activity, owner). Called on logout. */
export function clearAssistantChatStorage(): void {
  if (typeof sessionStorage === 'undefined') return;
  for (const key of ASSISTANT_CHAT_STORAGE_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore privacy-mode storage errors */
    }
  }
}
