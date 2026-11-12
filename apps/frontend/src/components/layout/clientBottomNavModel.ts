export interface ClientBottomTabModel {
  key: 'home' | 'search' | 'rentals' | 'orders' | 'account';
  path: string;
  active: boolean;
}

function rentalsRequests(pathname: string): boolean {
  return pathname === '/rentals/requests' || pathname.startsWith('/rentals/requests/');
}

function homeActive(pathname: string, rentalsTabEnabled: boolean): boolean {
  if (pathname === '/items' || pathname.startsWith('/items/') || pathname.startsWith('/foods')) {
    return true;
  }
  if (!pathname.startsWith('/rentals')) return false;
  if (rentalsTabEnabled && rentalsRequests(pathname)) return false;
  return true;
}

/** Flag off keeps Home · Search · Orders · Account, including /rentals as Home. */
export function clientBottomNavModel(input: {
  rentalsTabEnabled: boolean;
  pathname: string;
  search: string;
}): ClientBottomTabModel[] {
  const ordersActive =
    input.pathname === '/orders' ||
    (input.pathname.startsWith('/orders/') &&
      !input.pathname.startsWith('/orders/batch') &&
      !input.pathname.startsWith('/orders/confirmation'));
  const tabs: ClientBottomTabModel[] = [
    {
      key: 'home',
      path: '/items',
      active: homeActive(input.pathname, input.rentalsTabEnabled),
    },
    {
      key: 'search',
      path: '/items?focus=search',
      active: input.search.includes('focus=search'),
    },
  ];
  if (input.rentalsTabEnabled) {
    tabs.push({
      key: 'rentals',
      path: '/rentals/requests',
      active: rentalsRequests(input.pathname),
    });
  }
  tabs.push(
    { key: 'orders', path: '/orders', active: ordersActive },
    { key: 'account', path: '/profile', active: input.pathname.startsWith('/profile') }
  );
  return tabs;
}
