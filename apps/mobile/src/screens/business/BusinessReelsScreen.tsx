import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FAB, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import ReelsFeedScreen from '../shared/ReelsFeedScreen';
import { useTheme } from '@/contexts/ThemeContext';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { useTabBarGeometry } from '@/navigation/tabBarGeometry';

export default function BusinessReelsScreen() {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const { colors } = useTheme();
  const tabBarGeometry = useTabBarGeometry();
  const fabBottom = tabBarGeometry.tabBarOverlayHeight + 16;

  return (
    <View style={styles.root}>
      <ReelsFeedScreen />
      <IconButton
        icon="playlist-play"
        mode="contained"
        containerColor={colors.surface}
        iconColor={colors.primary.main}
        style={[styles.myReels, { bottom: fabBottom + 64 }]}
        onPress={() => navigation.navigate('BusinessMyReels')}
        accessibilityLabel={t('business.reels.myReels', 'My reels')}
      />
      <FAB
        icon="plus"
        label={t('business.reels.addFab', 'Add reel')}
        style={[
          styles.fab,
          { bottom: fabBottom, backgroundColor: colors.primary.main },
        ]}
        color="#fff"
        onPress={() => navigation.navigate('BusinessAddReel')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: { position: 'absolute', right: 16 },
  myReels: { position: 'absolute', right: 16, elevation: 4 },
});
