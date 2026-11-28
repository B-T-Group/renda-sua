import {
  FlightTakeoff,
  Handshake,
  RestaurantMenu,
  ShoppingBag,
} from '@mui/icons-material';
import type { ReactElement } from 'react';

export type BrowseLaneId = 'rentals' | 'exports' | 'shop' | 'food';

export interface BrowseLaneNavItem {
  key: BrowseLaneId;
  labelKey: string;
  labelDefault: string;
  path: string;
  icon: ReactElement;
}

/** Fixed lane order shown in every market: Rentals, Exports, Shop, Food. */
export const BROWSE_LANES: BrowseLaneNavItem[] = [
  {
    key: 'rentals',
    labelKey: 'client.home.lane.rentals',
    labelDefault: 'Rentals',
    path: '/rentals',
    icon: <Handshake />,
  },
  {
    key: 'exports',
    labelKey: 'client.home.lane.exports',
    labelDefault: 'Exports',
    path: '/exports',
    icon: <FlightTakeoff />,
  },
  {
    key: 'shop',
    labelKey: 'client.home.lane.shop',
    labelDefault: 'Shop',
    path: '/items',
    icon: <ShoppingBag />,
  },
  {
    key: 'food',
    labelKey: 'client.home.lane.food',
    labelDefault: 'Food',
    path: '/foods',
    icon: <RestaurantMenu />,
  },
];

export function isBrowseLanePathActive(
  pathname: string,
  path: string
): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Lane the market picker highlights. A lane path wins; otherwise the catalog the page
 * browses decides (rentals, or shop for inventory pages). Pages with neither (home,
 * account) highlight nothing.
 */
export function activeBrowseLane(
  pathname: string,
  catalogContext: 'inventory' | 'rentals' | 'all'
): BrowseLaneId | null {
  const byPath = BROWSE_LANES.find((lane) =>
    isBrowseLanePathActive(pathname, lane.path)
  );
  if (byPath) return byPath.key;
  if (catalogContext === 'rentals') return 'rentals';
  if (catalogContext === 'inventory') return 'shop';
  return null;
}
