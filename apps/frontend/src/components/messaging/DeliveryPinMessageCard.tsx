import { Key } from '@mui/icons-material';
import { Box, Chip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DeliveryPinStructuredContent } from '../../hooks/useOrderMessages';

interface DeliveryPinMessageCardProps {
  content: DeliveryPinStructuredContent;
  compact?: boolean;
}

export function DeliveryPinMessageCard({
  content,
  compact = false,
}: DeliveryPinMessageCardProps) {
  const { t } = useTranslation();

  const isActive = content.status === 'active';
  const isSuperseded = content.status === 'superseded';
  const isRevoked = content.status === 'revoked';

  const statusLabel = isSuperseded
    ? t('orders.messaging.deliveryPin.superseded', 'Superseded')
    : isRevoked
      ? t('orders.messaging.deliveryPin.revoked', 'No longer valid')
      : t('orders.messaging.deliveryPin.active', 'Active');

  return (
    <Box
      sx={{
        border: 1,
        borderColor: isActive ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: compact ? 1.5 : 2,
        bgcolor: isActive ? 'action.hover' : 'background.paper',
        maxWidth: 360,
      }}
      role="region"
      aria-label={t('orders.messaging.deliveryPin.cardA11y', 'Delivery PIN message')}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Key fontSize="small" color={isActive ? 'primary' : 'disabled'} />
        <Typography variant="subtitle2" fontWeight={600}>
          {t('orders.messaging.deliveryPin.title', 'Delivery PIN')}
        </Typography>
        {!isActive ? (
          <Chip size="small" label={statusLabel} variant="outlined" />
        ) : null}
      </Box>

      {content.pin ? (
        <Typography
          variant={compact ? 'h6' : 'h5'}
          component="div"
          sx={{
            fontFamily: 'monospace',
            letterSpacing: 4,
            textAlign: 'center',
            py: 1,
          }}
          aria-label={t('orders.messaging.deliveryPin.pinA11y', 'Delivery PIN {{pin}}', {
            pin: content.pin.split('').join(' '),
          })}
        >
          {content.pin}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {isActive
            ? t(
                'orders.messaging.deliveryPin.maskedActive',
                'Delivery PIN shared with {{agent}}',
                { agent: content.sharedToDisplayName ?? t('common.agent', 'agent') }
              )
            : t(
                'orders.messaging.deliveryPin.maskedInactive',
                'Delivery PIN (hidden)'
              )}
        </Typography>
      )}

      {content.sharedToDisplayName ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          {t(
            'orders.messaging.deliveryPin.sharedTo',
            'Shared with {{name}}',
            { name: content.sharedToDisplayName }
          )}
        </Typography>
      ) : null}
    </Box>
  );
}
