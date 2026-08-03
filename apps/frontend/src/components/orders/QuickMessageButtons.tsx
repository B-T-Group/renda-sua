import { CircularProgress, Stack, Button } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuickMessageTemplate } from '../../hooks/useBackendOrders';
import { useApiClient } from '../../hooks/useApiClient';

export interface QuickMessageButtonsProps {
  orderId: string;
  onSent?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const QuickMessageButtons: React.FC<QuickMessageButtonsProps> = ({
  orderId,
  onSent,
  onShowNotification,
}) => {
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const [templates, setTemplates] = useState<QuickMessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const loadTemplates = useCallback(async () => {
    if (!orderId || !apiClient) return;
    setLoading(true);
    try {
      const response = await apiClient.get<{
        success: boolean;
        templates: QuickMessageTemplate[];
      }>(`/orders/${orderId}/messages/quick-templates`);
      setTemplates(response.data?.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [apiClient, orderId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const handleSend = async (templateId: string) => {
    if (inFlightRef.current || !apiClient) return;
    inFlightRef.current = true;
    setSendingId(templateId);
    try {
      const response = await apiClient.post<{ success: boolean }>(
        `/orders/${orderId}/messages/quick`,
        { templateId }
      );
      if (!response.data?.success) {
        throw new Error(
          t('orders.quickMessages.sendError', 'Failed to send quick message')
        );
      }
      onShowNotification?.(
        t('orders.quickMessages.sendSuccess', 'Quick message sent.'),
        'success'
      );
      onSent?.();
      await loadTemplates();
    } catch (error) {
      const axiosData = (
        error as { response?: { data?: { error?: string; message?: string } } }
      )?.response?.data;
      const errorMessage =
        axiosData?.error ||
        axiosData?.message ||
        (error instanceof Error ? error.message : undefined) ||
        t('orders.quickMessages.sendError', 'Failed to send quick message');
      onShowNotification?.(errorMessage, 'error');
    } finally {
      inFlightRef.current = false;
      setSendingId(null);
    }
  };

  if (loading && templates.length === 0) {
    return (
      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
        <CircularProgress size={16} />
      </Stack>
    );
  }

  if (templates.length === 0) return null;

  const isFr = i18n.language?.startsWith('fr');

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      sx={{ mb: 1.5 }}
      aria-label={t('orders.quickMessages.actionsA11y', 'Quick messages')}
    >
      {templates.map((template) => {
        const label = isFr ? template.buttonLabelFr : template.buttonLabelEn;
        return (
          <Button
            key={template.id}
            size="small"
            variant="outlined"
            disabled={sendingId != null}
            onClick={() => void handleSend(template.id)}
            startIcon={
              sendingId === template.id ? (
                <CircularProgress size={14} color="inherit" />
              ) : undefined
            }
          >
            {t(template.buttonLabelKey, label)}
          </Button>
        );
      })}
    </Stack>
  );
};
