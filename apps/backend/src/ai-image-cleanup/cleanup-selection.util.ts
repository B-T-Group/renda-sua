import type {
  AiImageCleanupKind,
  CleanupImageSelection,
} from './ai-image-cleanup.types';

/** Bare imageIds ⇒ all ai (web compat). Explicit selections win. Dedupes by imageId+kind. */
export function normalizeCleanupSelections(args: {
  imageIds?: string[];
  selections?: CleanupImageSelection[];
}): CleanupImageSelection[] | null {
  let raw: CleanupImageSelection[] | null = null;
  if (args.selections?.length) {
    raw = args.selections.map((s) => ({
      imageId: s.imageId,
      kind: s.kind === 'rembg' ? 'rembg' : 'ai',
    }));
  } else if (args.imageIds != null) {
    raw = args.imageIds.map((imageId) => ({
      imageId,
      kind: 'ai' as const,
    }));
  }
  if (!raw) return null;
  const seen = new Set<string>();
  const deduped: CleanupImageSelection[] = [];
  for (const s of raw) {
    const key = `${s.imageId}:${s.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }
  return deduped;
}

export function countAiSelections(
  images: Array<{ kind: AiImageCleanupKind }>
): number {
  return images.filter((i) => i.kind === 'ai').length;
}
