import { Campaign } from '@mui/icons-material';
import { Box, Chip, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { QuickMessageStructuredContent } from '../../hooks/useOrderMessages';

interface QuickMessageCardProps {
  content: QuickMessageStructuredContent;
  compact?: boolean;
}

export function QuickMessageCard({
  content,
  compact = false,
}: QuickMessageCardProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'primary.main',
        borderRadius: 2,
        p: compact ? 1.5 : 2,
        bgcolor: 'action.hover',
        maxWidth: 360,
      }}
      role="region"
      aria-label={t('orders.quickMessages.cardA11y', 'Quick message')}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Campaign fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={600}>
          {t('orders.quickMessages.title', 'Quick message')}
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {t(content.bodyI18nKey, content.bodyDefault)}
      </Typography>
      {content.taggedPersonas.length > 0 ? (
        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }}>
          {content.taggedPersonas.map((persona) => (
            <Chip
              key={persona}
              size="small"
              label={t(`persona.${persona}`, persona)}
              variant="outlined"
            />
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
