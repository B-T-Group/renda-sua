import { observer } from 'mobx-react-lite';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { AppModal } from '../common/AppModal';
import { StockAvailabilityConfirmView } from './StockAvailabilityConfirmView';

/**
 * App-root overlay for stock availability checks (same pattern as OrderOfferOverlay).
 * Shows on foreground push and on notification tap, across personas.
 */
function StockAvailabilityOverlayBase() {
  const { stockAvailability } = useStore();
  const { colors } = useTheme();

  if (!stockAvailability.visible) return null;

  return (
    <AppModal
      visible={stockAvailability.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => stockAvailability.dismiss()}
    >
      <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
        <StockAvailabilityConfirmView
          uiState={stockAvailability.uiState}
          data={stockAvailability.data}
          qty={stockAvailability.qty}
          error={stockAvailability.error}
          onChangeQty={(q) => stockAvailability.setQty(q)}
          onConfirm={() => void stockAvailability.confirm()}
          onMarkUnavailable={() => void stockAvailability.markUnavailable()}
          onClose={() => stockAvailability.dismiss()}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export const StockAvailabilityOverlay = observer(StockAvailabilityOverlayBase);
