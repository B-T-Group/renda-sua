import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SearchScreen } from '../shared/SearchScreen';
import type { ClientRootStackParamList } from '../../navigation/types';

/** Full catalog search opened from the Home search bar after the Search tab is removed. */
export default function ClientCatalogSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<ClientRootStackParamList, 'ClientCatalogSearch'>>();
  return (
    <SearchScreen
      showBack
      foodOnly={route.params?.foodOnly === true}
      onBack={() => navigation.goBack()}
    />
  );
}
