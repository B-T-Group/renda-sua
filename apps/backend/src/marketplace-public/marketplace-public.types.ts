export interface MarketplaceLogoDto {
  id: string;
  name: string;
  logoUrl: string;
}

export interface MarketplacePublicStatsDto {
  clients: number;
  agents: number;
  merchants: number;
  products: number;
  cities: number;
  orders: number;
  setupMinutesMax: number;
  securePaymentsPercent: number;
  logos: MarketplaceLogoDto[];
}
