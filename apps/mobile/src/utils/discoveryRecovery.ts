import type { DiscoveryRecovery } from '@/types/inventoryCatalog';

export function hasRecoveryContent(
  recovery: DiscoveryRecovery,
  canAskRenda: boolean
): boolean {
  return (
    recovery.relax.length > 0 ||
    recovery.similar.length > 0 ||
    recovery.categories.length > 0 ||
    recovery.popular_near_you.length > 0 ||
    (recovery.ask_renda.enabled && canAskRenda)
  );
}
