import {
  getBusinessOrderActions,
  type BusinessOrderAction,
} from './businessOrderActions';
import {
  rankOrderDetailActions,
  type RankedOrderAction,
  type RankedOrderActions,
} from './rankOrderDetailActions';
import type { BusinessOrder } from '../types/business/orders';

function toRanked(action: BusinessOrderAction): RankedOrderAction {
  return {
    id: action.id,
    labelKey: action.labelKey,
    defaultLabel: action.defaultLabel,
    destructive: action.destructive,
    preferred: action.primary,
  };
}

/** Sticky-bar ranking for business (and delegate) order detail. */
export function rankBusinessOrderDetailActions(
  order: BusinessOrder,
  options?: { mode?: 'owner' | 'delegate' }
): RankedOrderActions {
  const actions = getBusinessOrderActions(order, options).map(toRanked);
  const preferred = actions.find((a) => a.preferred)?.id ?? null;
  return rankOrderDetailActions(actions, preferred);
}
