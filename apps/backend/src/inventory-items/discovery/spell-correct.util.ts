/** R1 typo correction (#342): conservative, vocabulary-based, no external service. */

export function foldText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function tokenize(input: string): string[] {
  return foldText(input)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Optimal-string-alignment distance (insert, delete, substitute, adjacent transposition). */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

export type Vocabulary = Map<string, number>; // token -> frequency

export function buildVocabulary(phrases: string[]): Vocabulary {
  const v: Vocabulary = new Map();
  for (const p of phrases) {
    for (const t of tokenize(p)) {
      if (t.length >= 3) v.set(t, (v.get(t) ?? 0) + 1);
    }
  }
  return v;
}

function maxEdits(len: number): number {
  if (len < 4) return 0;
  return len >= 8 ? 2 : 1;
}

function correctToken(token: string, vocab: Vocabulary): string | null {
  if (token.length < 4 || vocab.has(token)) return null;
  const limit = maxEdits(token.length);
  let best: { word: string; dist: number; freq: number } | null = null;
  let runnerUp: { dist: number; freq: number } | null = null;
  for (const [word, freq] of vocab) {
    if (word[0] !== token[0]) continue; // typos rarely hit the first letter
    const dist = editDistance(token, word, limit);
    if (dist === 0 || dist > limit) continue;
    if (!best || dist < best.dist || (dist === best.dist && freq > best.freq)) {
      if (best) runnerUp = { dist: best.dist, freq: best.freq };
      best = { word, dist, freq };
    } else if (!runnerUp || dist < runnerUp.dist || freq > runnerUp.freq) {
      runnerUp = { dist, freq };
    }
  }
  if (!best) return null;
  // High confidence only: unique best, or clearly more frequent than the next candidate.
  if (runnerUp && runnerUp.dist === best.dist && best.freq < runnerUp.freq * 2) {
    return null;
  }
  return best.word;
}

/** Returns the corrected query, or null when nothing can be corrected with high confidence. */
export function correctQuery(query: string, vocab: Vocabulary): string | null {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  let changed = false;
  const out = tokens.map((t) => {
    const fixed = correctToken(t, vocab);
    if (fixed) changed = true;
    return fixed ?? t;
  });
  return changed ? out.join(' ') : null;
}
