import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import { useClientFlags } from '../../contexts/ClientFlagsContext';
import { RentalSearchFirstScreen } from '../shared/RentalSearchFirstScreen';
import { RentalsBrowseScreen } from '../shared/RentalsBrowseScreen';
import type { ClientRootStackParamList } from '../../navigation/types';

function ClientRentalsHomeScreenBase() {
  const { t } = useTranslation();
  const { flags } = useClientFlags();
  const navigation = useNavigation();
  const rootNav =
    navigation.getParent<NativeStackNavigationProp<ClientRootStackParamList> | undefined>();

  const onOpenListing = useCallback(
    (listingId: string) => {
      rootNav?.navigate('RentalListingDetail', { listingId });
    },
    [rootNav]
  );

  const onMyRentals = useCallback(() => {
    rootNav?.navigate('ClientMyRentals');
  }, [rootNav]);

  if (flags.rentals_search_first_enabled) {
    return <RentalSearchFirstScreen withAuth applyTopSafeArea={false} />;
  }

  return (
    <RentalsBrowseScreen
      withAuth
      applyTopSafeArea={false}
      onOpenListing={onOpenListing}
      headerExtra={
        flags.rentals_client_tab_enabled ? null : (
          <Button mode="contained-tonal" icon="clipboard-list-outline" onPress={onMyRentals}>
            {t('client.rentals.tabMyRentals', 'My rentals')}
          </Button>
        )
      }
    />
  );
}

export default observer(ClientRentalsHomeScreenBase);
