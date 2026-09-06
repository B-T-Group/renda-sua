import React from 'react';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useTheme } from '@/contexts/ThemeContext';
import { useProfileMe } from '../../hooks/useProfileMe';
import BusinessItemsListScreen from './BusinessItemsListScreen';
import BusinessRentalsStudioScreen from './BusinessRentalsStudioScreen';

/**
 * Catalog tab: sale items or rentals studio based on business main_interest.
 */
export default function BusinessCatalogTabScreen() {
  const { me, loading } = useProfileMe();
  const { colors, spacing } = useTheme();

  if (loading && !me) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
          backgroundColor: colors.pageBackground,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  const isRental = me?.business?.main_interest === 'rent_items';
  if (isRental) {
    return <BusinessRentalsStudioScreen />;
  }
  return <BusinessItemsListScreen />;
}
