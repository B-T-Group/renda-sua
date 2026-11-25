export const MARKET_LANE_ORDER = [
  'rentals',
  'exports',
  'shop',
  'food',
] as const;

export type MarketLaneId = (typeof MARKET_LANE_ORDER)[number];

export interface MarketLaneFlags {
  rentals: boolean;
  exports: boolean;
  shop: boolean;
  food: boolean;
}

export interface MarketLanesResult {
  country_code: string;
  lanes: MarketLaneFlags;
  visible: MarketLaneId[];
}

export function visibleMarketLanes(lanes: MarketLaneFlags): MarketLaneId[] {
  return MARKET_LANE_ORDER.filter((lane) => lanes[lane]);
}
