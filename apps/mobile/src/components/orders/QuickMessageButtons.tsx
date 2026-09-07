import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { QuickMessageTemplate } from '../../services/agentApi';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  orderId: string;
  /** Reload templates when order status changes on the same screen. */
  orderStatus?: string | null;
  onSent?: () => void;
  onError?: (message: string) => void;
  onSuccess?: (message: string) => void;
};

export function QuickMessageButtons({
  orderId,
  orderStatus,
  onSent,
  onError,
  onSuccess,
}: Props) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const ordersApi = useOrdersApi();
  const [templates, setTemplates] = useState<QuickMessageTemplate[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    if (!orderId) return;
    try {
      const list = await ordersApi.getQuickMessageTemplates(orderId);
      setTemplates(list);
    } catch {
      // Keep existing buttons on transient reload failures for the same order/status.
    }
  }, [orderId, ordersApi]);

  useEffect(() => {
    setTemplates([]);
    void loadTemplates();
  }, [loadTemplates, orderStatus]);

  const handleSend = useCallback(
    async (templateId: string) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setSendingId(templateId);
      try {
        await ordersApi.sendQuickMessage(orderId, templateId);
        onSuccess?.(
          t('orders.quickMessages.sendSuccess', 'Quick message sent.')
        );
        onSent?.();
        await loadTemplates();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : t('orders.quickMessages.sendError', 'Failed to send quick message');
        onError?.(message);
      } finally {
        inFlightRef.current = false;
        setSendingId(null);
      }
    },
    [loadTemplates, onError, onSent, onSuccess, orderId, ordersApi, t]
  );

  if (templates.length === 0) return null;

  const isFr = i18n.language?.startsWith('fr');

  return (
    <View
      style={[styles.row, { gap: spacing.xs, marginBottom: spacing.sm }]}
      accessibilityLabel={t('orders.quickMessages.actionsA11y', 'Quick messages')}
    >
      {templates.map((template) => {
        const label = isFr ? template.buttonLabelFr : template.buttonLabelEn;
        return (
          <Button
            key={template.id}
            mode="outlined"
            compact
            disabled={sendingId != null}
            loading={sendingId === template.id}
            onPress={() => void handleSend(template.id)}
            style={styles.button}
          >
            {t(template.buttonLabelKey, label)}
          </Button>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    marginBottom: 4,
  },
});
