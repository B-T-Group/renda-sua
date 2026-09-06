import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { BusinessMainTabParamList } from '../navigation/types';

type Nav = NavigationProp<ParamListBase>;

export type BusinessMainInterest = 'sell_items' | 'rent_items' | string;

/**
 * Jump to the business Orders tab (nested under BusinessMainTabs).
 * Prefer this over pushing the stack BusinessOrdersList screen.
 * Always sets cashReconciliation explicitly so prior deep-link params do not stick.
 */
export function navigateBusinessOrdersTab(
  navigation: Nav,
  params?: BusinessMainTabParamList['BusinessOrders']
): void {
  navigation.navigate({
    name: 'BusinessMainTabs',
    params: {
      screen: 'BusinessOrders',
      params: {
        cashReconciliation: params?.cashReconciliation === true,
      },
      merge: false,
    },
  } as never);
}

/**
 * Jump to the business Catalog tab (Items or Rentals by main_interest).
 * Uses merge: false so prior location/moderation/tab filters do not stick.
 */
export function navigateBusinessCatalogTab(
  navigation: Nav,
  params?: BusinessMainTabParamList['BusinessCatalog']
): void {
  navigation.navigate({
    name: 'BusinessMainTabs',
    params: {
      screen: 'BusinessCatalog',
      params: params ?? {},
      merge: false,
    },
  } as never);
}

type CatalogFilterParams = {
  locationId?: string;
  moderationStatus?: 'rejected' | 'proposal_pending';
};

/**
 * Open the sale-items catalog: Catalog tab when that is the primary interest,
 * otherwise the stack Items list (secondary for rental-focused merchants).
 */
export function navigateBusinessSaleItems(
  navigation: Nav,
  mainInterest: BusinessMainInterest,
  params?: CatalogFilterParams
): void {
  if (mainInterest === 'rent_items') {
    navigation.navigate('BusinessItemsList', params ?? {});
    return;
  }
  navigateBusinessCatalogTab(navigation, params);
}

/**
 * Open the rentals catalog: Catalog tab when that is the primary interest,
 * otherwise the stack Rentals studio (secondary for sale-focused merchants).
 */
export function navigateBusinessRentals(
  navigation: Nav,
  mainInterest: BusinessMainInterest,
  params?: CatalogFilterParams & { tab?: 'catalog' | 'requests' | 'schedule' }
): void {
  if (mainInterest === 'rent_items') {
    navigateBusinessCatalogTab(navigation, {
      tab: params?.tab ?? 'catalog',
      locationId: params?.locationId,
      moderationStatus: params?.moderationStatus,
    });
    return;
  }
  navigation.navigate('BusinessRentalsStudio', {
    tab: params?.tab ?? 'catalog',
    moderationStatus: params?.moderationStatus,
  });
}
