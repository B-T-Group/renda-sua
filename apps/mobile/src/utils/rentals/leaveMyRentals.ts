type LeaveNavigation = {
  canGoBack: () => boolean;
  goBack: () => void;
  navigate: (screen: string, params?: { screen: string; params: { segment: string } }) => void;
};

/**
 * Pop My rentals. The Rentals tab stays mounted, so its query, dates, and category stay.
 * When this screen is the only route, open Rentals instead of exiting.
 */
export function leaveMyRentals(navigation: LeaveNavigation): void {
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  navigation.navigate('ClientMainTabs', {
    screen: 'ClientBrowse',
    params: { segment: 'rentals' },
  });
}
