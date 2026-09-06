import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useCountdown } from '../../hooks/useCountdown';
import { useStore } from '../../stores/RootStore';
import { AppModal } from '../common/AppModal';
import { OrderOfferView } from './OrderOfferView';

/**
 * App-root, cross-persona overlay that renders the full-screen delivery offer.
 * Rendered above the navigator so it shows regardless of the active persona's
 * navigator tree.
 */
function OrderOfferOverlayBase() {
  const { orderOffer } = useStore();
  const { colors } = useTheme();

  const handleExpire = useCallback(() => {
    if (orderOffer.uiState === 'active') {
      void orderOffer.decline();
    }
  }, [orderOffer]);

  const expiresAt =
    orderOffer.uiState === 'active' || orderOffer.uiState === 'accepting'
      ? (orderOffer.details?.expiresAt ?? null)
      : null;
  const secondsLeft = useCountdown(expiresAt, handleExpire);

  if (!orderOffer.visible) return null;

  return (
    <AppModal
      visible={orderOffer.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => orderOffer.decline()}
    >
      <View style={[styles.fill, { backgroundColor: colors.pageBackground }]}>
        <OrderOfferView
          uiState={orderOffer.uiState}
          details={orderOffer.details}
          message={orderOffer.message}
          secondsLeft={secondsLeft}
          onAccept={() => orderOffer.accept()}
          onDecline={() => orderOffer.decline()}
          onClose={() => orderOffer.dismiss()}
          onGoToAvailable={() => orderOffer.goToAvailableOrders()}
        />
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export const OrderOfferOverlay = observer(OrderOfferOverlayBase);
