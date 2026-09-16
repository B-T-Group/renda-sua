type HasuraErrorShape = {
  message?: unknown;
  response?: { errors?: Array<{ message?: unknown }> };
};

export function isMissingReelViewReference(error: unknown): boolean {
  const text = hasuraErrorText(error);
  return (
    text.includes('reel_view_events_reel_id_fkey') ||
    text.includes('reel_view_events_user_id_fkey')
  );
}

function hasuraErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const err = error as HasuraErrorShape;
  const nested = (err.response?.errors ?? [])
    .map((entry) => String(entry?.message ?? ''))
    .join(' ');
  return `${String(err.message ?? '')} ${nested}`;
}
