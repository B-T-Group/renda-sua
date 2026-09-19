export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export function addFrequency(start: Date, frequency: ScheduleFrequency): Date {
  const next = new Date(start.getTime());
  if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === 'biweekly') next.setUTCDate(next.getUTCDate() + 14);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export function currentPeriod(
  startsAt: Date,
  frequency: ScheduleFrequency,
  now: Date,
  endsAt?: Date | null
): { start: Date; end: Date } | null {
  if (now.getTime() < startsAt.getTime()) return null;
  let start = new Date(startsAt.getTime());
  let end = addFrequency(start, frequency);
  while (end.getTime() <= now.getTime()) {
    start = end;
    end = addFrequency(start, frequency);
  }
  if (endsAt && start.getTime() >= endsAt.getTime()) return null;
  return { start, end };
}
