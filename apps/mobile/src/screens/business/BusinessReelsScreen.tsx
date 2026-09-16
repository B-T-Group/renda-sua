import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ReelsFeedScreen from '../shared/ReelsFeedScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBarGeometry } from '@/navigation/tabBarGeometry';

export default function BusinessReelsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const tabBarGeometry = useTabBarGeometry();
  const fabBottom = tabBarGeometry.tabBarOverlayHeight + 16;

  return (
    <View style={styles.root}>
      <ReelsFeedScreen />
      <FAB
        icon="plus"
        label={t('business.reels.addFab', 'Add reel')}
        style={[
          styles.fab,
          { bottom: fabBottom, backgroundColor: colors.primary.main },
        ]}
        color="#fff"
        onPress={() =>
          (navigation as { navigate: (n: string) => void }).navigate(
            'BusinessAddReel'
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: { position: 'absolute', right: 16 },
});
