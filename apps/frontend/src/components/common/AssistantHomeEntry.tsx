import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Box, Button, Paper, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

type Props = {
  compact?: boolean;
};

/**
 * Dashboard / home entry linking to the dedicated /assistant page.
 */
export function AssistantHomeEntry({ compact = false }: Props) {
  const { t } = useTranslation();

  if (compact) {
    return (
      <Button
        component={RouterLink}
        to="/assistant"
        variant="outlined"
        size="small"
        startIcon={<AutoAwesomeIcon />}
        sx={{
          borderColor: 'info.main',
          color: 'info.dark',
          textTransform: 'none',
          fontWeight: 600,
        }}
      >
        {t('assistant.homeEntryCta', 'Open assistant')}
      </Button>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'info.light',
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.info.main}12 0%, ${theme.palette.background.paper} 70%)`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1.5,
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
          <AutoAwesomeIcon color="info" sx={{ mt: 0.25 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('assistant.homeEntryTitle', 'Ask the AI assistant')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'assistant.homeEntryBody',
                'Get quick answers about delivery, payments, pickup, and your account.'
              )}
            </Typography>
          </Box>
        </Box>
        <Button
          component={RouterLink}
          to="/assistant"
          variant="contained"
          color="info"
          startIcon={<AutoAwesomeIcon />}
          sx={{ textTransform: 'none', flexShrink: 0 }}
        >
          {t('assistant.homeEntryCta', 'Open assistant')}
        </Button>
      </Box>
    </Paper>
  );
}

export default AssistantHomeEntry;
