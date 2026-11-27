/** Split free text on commas / new lines into trimmed, non-empty tags. */
export function parseTagInput(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Append tags from raw input, skipping case-insensitive duplicates. */
export function addTags(existing: string[], raw: string): string[] {
  const seen = new Set(existing.map((tag) => tag.toLowerCase()));
  const next = [...existing];
  for (const tag of parseTagInput(raw)) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(tag);
  }
  return next;
}

export function removeTag(tags: string[], tag: string): string[] {
  return tags.filter((entry) => entry !== tag);
}
