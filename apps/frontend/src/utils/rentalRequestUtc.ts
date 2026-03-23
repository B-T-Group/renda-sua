const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * API timestamp from the picker’s calendar date and clock time (no timezone conversion).
 * Shape: `YYYY-MM-ddThh:mm:00.000Z` as requested for the backend payload.
 */
export function requestedSlotUtcIso(dateKey: string, hour: number, minute = 0): string {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new RangeError('Invalid dateKey; expected YYYY-MM-DD');
  }
  const h = Math.floor(hour);
  const m = Math.floor(minute);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new RangeError('Invalid hour or minute');
  }
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dateKey}T${hh}:${mm}:00.000Z`;
}

/** Local wall date (YYYY-MM-DD) and time from a picker instant (epoch ms). */
export function localPickerInstantToRequestParts(ms: number): {
  dateKey: string;
  hour: number;
  minute: number;
} {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError('Invalid instant');
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    dateKey: `${y}-${mo}-${day}`,
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}
