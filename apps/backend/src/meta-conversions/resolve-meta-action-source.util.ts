import type { MetaActionSource } from './meta-conversions.types';

export function resolveMetaActionSource(
  platform?: string | null
): MetaActionSource {
  const p = (platform || '').trim().toLowerCase();
  if (p === 'ios' || p === 'android' || p === 'mobile' || p === 'app') {
    return 'app';
  }
  if (p === 'web' || p === 'website') return 'website';
  return 'website';
}
