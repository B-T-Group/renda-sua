import type { HomeLane } from '../components/client/HomeLaneSwitcher';

export type HomeLaneSegment = 'all' | 'food' | 'rentals' | 'exports';

export function laneFromSegment(segment: HomeLaneSegment | undefined): HomeLane {
  if (segment === 'food') return 'food';
  if (segment === 'rentals') return 'rentals';
  if (segment === 'exports') return 'exports';
  return 'shop';
}

export function segmentFromLane(lane: HomeLane): HomeLaneSegment {
  return lane === 'shop' ? 'all' : lane;
}
