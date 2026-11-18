export function useBusinessInsightsScreen() {
  return {
    loading: false,
    refreshing: false,
    error: null,
    uniqueClientCount: 18,
    conditionDeclines90d: 2,
    pickupsReached90d: 11,
    totalProductViews: 40,
    productViewsLast7d: 9,
    topViewedProducts: [],
    onOpenClientCities: () => undefined,
    onOpenTopViewedProduct: () => undefined,
    onRefresh: async () => undefined,
    retry: async () => undefined,
  };
}
