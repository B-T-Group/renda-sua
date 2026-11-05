/**
 * Ranks order-detail actions into a sticky-bar shape:
 * one primary, optional companion (usually Cancel), rest in More.
 */

export type RankedOrderAction = {
  id: string;
  labelKey: string;
  defaultLabel: string;
  destructive?: boolean;
  /** Prefer this action when no preferredPrimaryId is given. */
  preferred?: boolean;
};

export type RankedOrderActions = {
  primary: RankedOrderAction | null;
  companion: RankedOrderAction | null;
  overflow: RankedOrderAction[];
};

const COMPANION_IDS = new Set(['cancel']);

export function rankOrderDetailActions(
  actions: RankedOrderAction[],
  preferredPrimaryId?: string | null
): RankedOrderActions {
  if (actions.length === 0) {
    return { primary: null, companion: null, overflow: [] };
  }

  const preferredId =
    preferredPrimaryId && preferredPrimaryId !== 'none'
      ? preferredPrimaryId
      : null;
  const byPreferredId = preferredId
    ? actions.find((a) => a.id === preferredId)
    : undefined;
  const byFlag = actions.find((a) => a.preferred);
  const primary = byPreferredId ?? byFlag ?? actions[0];
  const remaining = actions.filter((a) => a.id !== primary.id);

  const companionCandidate =
    remaining.find((a) => COMPANION_IDS.has(a.id)) ??
    (remaining.length === 1 ? remaining[0] : undefined);

  if (!companionCandidate) {
    return { primary, companion: null, overflow: remaining };
  }

  return {
    primary,
    companion: companionCandidate,
    overflow: remaining.filter((a) => a.id !== companionCandidate.id),
  };
}
