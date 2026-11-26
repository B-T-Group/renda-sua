import { useCallback } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { HomeLaneHeader } from '../../components/client/HomeLaneHeader';
import type { HomeLane } from '../../components/client/HomeLaneSwitcher';
import { useTheme } from '../../contexts/ThemeContext';
import type { GuestTabParamList } from '../../navigation/types';
import { laneFromSegment, segmentFromLane } from '../../utils/homeLaneSegment';
import GuestBrowseScreen from './GuestBrowseScreen';
import GuestRentalsScreen from './GuestRentalsScreen';

function LaneContent({ lane }: { lane: HomeLane }) {
  if (lane === 'rentals') return <GuestRentalsScreen />;
  return (
    <GuestBrowseScreen
      key={lane}
      foodOnly={lane === 'food'}
      exportOnly={lane === 'exports'}
    />
  );
}

/** Guest Home: shared market selector + lane menu above the active lane's content. */
export default observer(function GuestHomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<GuestTabParamList, 'GuestHome'>>();
  const route = useRoute<RouteProp<GuestTabParamList, 'GuestHome'>>();
  const lane = laneFromSegment(route.params?.segment);

  const onLaneChange = useCallback(
    (next: HomeLane) => navigation.setParams({ segment: segmentFromLane(next) }),
    [navigation]
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.pageBackground }}>
      <HomeLaneHeader value={lane} onChange={onLaneChange} />
      <View style={{ flex: 1 }}>
        <LaneContent lane={lane} />
      </View>
    </View>
  );
});
