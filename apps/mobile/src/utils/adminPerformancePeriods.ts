import type {
  PerformancePeriodEdge,
  PerformancePeriodUnit,
  PerformanceWindow,
} from '../types/adminPerformance';

function startOfWeekMonday(input: Date): Date {
  const date = new Date(input);
  const offsetFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offsetFromMonday);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(input: Date): Date {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
}

function weekWindow(reference: Date): PerformanceWindow {
  const from = startOfWeekMonday(reference);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from: from.toISOString(), to: endOfDay(to).toISOString() };
}

function monthWindow(reference: Date): PerformanceWindow {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { from: from.toISOString(), to: endOfDay(to).toISOString() };
}

function yearWindow(reference: Date): PerformanceWindow {
  const from = new Date(reference.getFullYear(), 0, 1);
  const to = new Date(reference.getFullYear(), 11, 31);
  return { from: from.toISOString(), to: endOfDay(to).toISOString() };
}

/** Resolve a period preset (e.g. "last month") to an inclusive ISO window. */
export function resolvePerformanceWindow(
  unit: PerformancePeriodUnit,
  edge: PerformancePeriodEdge,
  now: Date = new Date()
): PerformanceWindow {
  const reference = new Date(now);
  if (edge === 'last') {
    if (unit === 'week') reference.setDate(reference.getDate() - 7);
    if (unit === 'month') reference.setMonth(reference.getMonth() - 1, 1);
    if (unit === 'year') reference.setFullYear(reference.getFullYear() - 1, 0, 1);
  }
  if (unit === 'week') return weekWindow(reference);
  if (unit === 'month') return monthWindow(reference);
  return yearWindow(reference);
}
