import type {
  ImageCleanupKind,
  ImageCleanupKindSelection,
  ImageCleanupSelection,
} from '@/types/imageCleanup';

export type CleanupKindsByIndex = Record<number, ImageCleanupKindSelection>;

export function countAiCleanupSelections(
  kinds: CleanupKindsByIndex
): number {
  return Object.values(kinds).filter((k) => k === 'ai').length;
}

export function aiTokensRemainingAfterSelections(
  aiTokens: number,
  kinds: CleanupKindsByIndex
): number {
  return Math.max(0, aiTokens - countAiCleanupSelections(kinds));
}

export function canSelectAiCleanup(
  aiTokens: number,
  kinds: CleanupKindsByIndex,
  index: number
): boolean {
  if (kinds[index] === 'ai') return true;
  return aiTokensRemainingAfterSelections(aiTokens, kinds) > 0;
}

export function toggleCleanupKindAt(
  kinds: CleanupKindsByIndex,
  index: number,
  next: ImageCleanupKind,
  aiTokens: number
): CleanupKindsByIndex {
  if (kinds[index] === next) {
    return { ...kinds, [index]: null };
  }
  if (next === 'ai' && !canSelectAiCleanup(aiTokens, kinds, index)) {
    return kinds;
  }
  return { ...kinds, [index]: next };
}

export function removeCleanupKindAt(
  kinds: CleanupKindsByIndex,
  index: number
): CleanupKindsByIndex {
  const next: CleanupKindsByIndex = {};
  for (const [key, value] of Object.entries(kinds)) {
    const i = Number(key);
    if (Number.isNaN(i) || i === index) continue;
    next[i > index ? i - 1 : i] = value;
  }
  return next;
}

export function reorderCleanupKindsToMain(
  kinds: CleanupKindsByIndex,
  index: number
): CleanupKindsByIndex {
  if (index <= 0) return kinds;
  const entries = Object.entries(kinds)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([i]) => !Number.isNaN(i));
  const next: CleanupKindsByIndex = {};
  for (const [i, value] of entries) {
    if (i === index) next[0] = value;
    else if (i < index) next[i + 1] = value;
    else next[i] = value;
  }
  return next;
}

export function hasAnyCleanupSelection(kinds: CleanupKindsByIndex): boolean {
  return Object.values(kinds).some((k) => k === 'rembg' || k === 'ai');
}

export function buildCleanupSelections(
  imageIds: Array<string | null | undefined>,
  kinds: CleanupKindsByIndex
): ImageCleanupSelection[] {
  const selections: ImageCleanupSelection[] = [];
  for (let i = 0; i < imageIds.length; i++) {
    const kind = kinds[i];
    const imageId = imageIds[i];
    if ((kind === 'rembg' || kind === 'ai') && imageId) {
      selections.push({ imageId, kind });
    }
  }
  return selections;
}

export function cleanupKindsFromDraft(
  raw: Record<string, ImageCleanupKindSelection> | undefined
): CleanupKindsByIndex {
  if (!raw) return {};
  const next: CleanupKindsByIndex = {};
  for (const [key, value] of Object.entries(raw)) {
    const i = Number(key);
    if (Number.isNaN(i)) continue;
    if (value === 'rembg' || value === 'ai' || value === null) {
      next[i] = value;
    }
  }
  return next;
}
