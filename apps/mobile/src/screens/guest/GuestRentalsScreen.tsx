import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { observer } from 'mobx-react-lite';
import { RentalsBrowseScreen } from '../shared/RentalsBrowseScreen';
import type { GuestRootStackParamList, GuestTabParamList } from '../../navigation/types';

export default observer(function GuestRentalsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<GuestTabParamList>>();

  const onOpenListing = useCallback(
    (listingId: string) => {
      const parent =
        navigation.getParent<NativeStackNavigationProp<GuestRootStackParamList> | undefined>();
      parent?.navigate('RentalListingDetail', { listingId });
    },
    [navigation]
  );

  return <RentalsBrowseScreen withAuth={false} onOpenListing={onOpenListing} />;
});
