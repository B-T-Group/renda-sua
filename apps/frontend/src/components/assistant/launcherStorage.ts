/** Device/session state for the assistant launcher (spec #451 §1). Every access is guarded. */

export const NUDGE_SEEN_KEY = 'assistant.nudge.v1.seen';
export const LAUNCHER_SESSIONS_KEY = 'assistant.launcher.sessions.v1';
export const LAUNCHER_SESSION_MARK_KEY = 'assistant.launcher.session.v1';
export const ATTENTION_LOG_KEY = 'assistant.attention.v1.log';
export const ATTENTION_SESSION_KEY = 'assistant.attention.session.v1';
export const IMPRESSIONS_SESSION_KEY = 'assistant.launcher.impressions.v1';

/** Extended "Ask" label for the first 3 app sessions. */
export const EXTENDED_LABEL_SESSIONS = 3;
/** Attention cap: 1 per app session, 3 per rolling 7 days. */
export const ATTENTION_PER_WEEK = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Store = 'local' | 'session';
function storage(kind: Store): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function read(kind: Store, key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(kind: Store, key: string, value: string): void {
  try {
    storage(kind)?.setItem(key, value);
  } catch {
    /* quota / privacy mode */
  }
}

export function hasSeenNudge(): boolean {
  return read('local', NUDGE_SEEN_KEY) === '1';
}
/** Stored per device; the nudge never shows again, including after a dismiss. */
export function markNudgeSeen(): void {
  write('local', NUDGE_SEEN_KEY, '1');
}

/** Counts this tab session once and returns the session number (1-based). */
export function launcherSessionNumber(): number {
  const prev = Number(read('local', LAUNCHER_SESSIONS_KEY) || '0') || 0;
  if (read('session', LAUNCHER_SESSION_MARK_KEY) === '1')
    return Math.max(prev, 1);
  const next = prev + 1;
  write('local', LAUNCHER_SESSIONS_KEY, String(next));
  write('session', LAUNCHER_SESSION_MARK_KEY, '1');
  return next;
}

function attentionLog(now: number): number[] {
  try {
    const raw = JSON.parse(read('local', ATTENTION_LOG_KEY) || '[]');
    return Array.isArray(raw)
      ? raw.filter(
          (n): n is number =>
            typeof n === 'number' && now - n < WEEK_MS && n <= now
        )
      : [];
  } catch {
    return [];
  }
}

export function canPlayAttention(now = Date.now()): boolean {
  if (read('session', ATTENTION_SESSION_KEY) === '1') return false;
  return attentionLog(now).length < ATTENTION_PER_WEEK;
}

export function recordAttention(now = Date.now()): void {
  write('session', ATTENTION_SESSION_KEY, '1');
  write(
    'local',
    ATTENTION_LOG_KEY,
    JSON.stringify([...attentionLog(now), now])
  );
}

/** Impression once per app session per screen: true the first time only. */
export function claimImpression(screen: string): boolean {
  let seen: string[] = [];
  try {
    const raw = JSON.parse(read('session', IMPRESSIONS_SESSION_KEY) || '[]');
    if (Array.isArray(raw))
      seen = raw.filter((s): s is string => typeof s === 'string');
  } catch {
    seen = [];
  }
  if (seen.includes(screen)) return false;
  write('session', IMPRESSIONS_SESSION_KEY, JSON.stringify([...seen, screen]));
  return true;
}
