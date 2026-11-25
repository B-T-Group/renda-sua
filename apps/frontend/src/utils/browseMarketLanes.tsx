import {
  FlightTakeoff,
  Handshake,
  RestaurantMenu,
  ShoppingBag,
} from '@mui/icons-material';
import type { ReactElement } from 'react';
import type { MarketLaneId } from '../hooks/useMarketLanes';

export interface BrowseLaneNavItem {
  key: MarketLaneId;
  labelKey: string;
  labelDefault: string;
  path: string;
  icon: ReactElement;
}

const BROWSE_LANE_DEFS: Record<MarketLaneId, BrowseLaneNavItem> = {
  rentals: {
    key: 'rentals',
    labelKey: 'rentals.title',
    labelDefault: 'Rentals',
    path: '/rentals',
    icon: <Handshake />,
  },
  exports: {
    key: 'exports',
    labelKey: 'exportCatalog.chip',
    labelDefault: 'Exports',
    path: '/exports',
    icon: <FlightTakeoff />,
  },
  shop: {
    key: 'shop',
    labelKey: 'client.home.lane.shop',
    labelDefault: 'Shop',
    path: '/items',
    icon: <ShoppingBag />,
  },
  food: {
    key: 'food',
    labelKey: 'foods.title',
    labelDefault: 'Food',
    path: '/foods',
    icon: <RestaurantMenu />,
  },
};

export function browseLaneNavItems(
  visible: MarketLaneId[]
): BrowseLaneNavItem[] {
  return visible.map((id) => BROWSE_LANE_DEFS[id]).filter(Boolean);
}

export function isBrowseLanePathActive(
  pathname: string,
  path: string
): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}
