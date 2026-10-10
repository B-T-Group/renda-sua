type CleanupSnapshot = {
  id?: string;
  open_cleanup_kinds?: string[] | null;
};

export function isAiCleanupRunning(
  image: CleanupSnapshot,
  pendingIds?: ReadonlySet<string>
): boolean {
  if (image.open_cleanup_kinds?.includes('ai')) return true;
  return !!image.id && !!pendingIds?.has(image.id);
}

export function handoffOpenCleanupPending(
  pending: ReadonlySet<string>,
  images: CleanupSnapshot[]
): ReadonlySet<string> {
  const next = new Set(pending);
  let changed = false;
  for (const img of images) {
    if (img.id && img.open_cleanup_kinds?.includes('ai') && next.delete(img.id)) {
      changed = true;
    }
  }
  return changed ? next : pending;
}

export function releaseFinishedCleanupPending(
  pending: ReadonlySet<string>,
  images: CleanupSnapshot[]
): ReadonlySet<string> {
  const finished = new Set(
    images
      .filter((img) => img.id && !img.open_cleanup_kinds?.includes('ai'))
      .map((img) => img.id as string)
  );
  const next = new Set(pending);
  let changed = false;
  for (const id of pending) {
    if (finished.has(id) && next.delete(id)) changed = true;
  }
  return changed ? next : pending;
}
