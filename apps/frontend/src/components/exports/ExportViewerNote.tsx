import { Public } from '@mui/icons-material';
import { Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ExportViewerRole } from '../../utils/exportItemRules';
import { formatExportDestinations } from '../../utils/exportItemRules';

interface ExportViewerNoteProps {
  role: ExportViewerRole;
  marketCode?: string | null;
  destinations: string[];
  /** `card`: globe + destinations line. `pdp`: the origin / third-market sentence. */
  variant: 'card' | 'pdp';
}

/** Shown instead of "I’m interested" to origin and third-market viewers. */
export const ExportViewerNote: React.FC<ExportViewerNoteProps> = ({
  role,
  marketCode,
  destinations,
  variant,
}) => {
  const { t } = useTranslation();
  if (variant === 'card') {
    return (
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
        data-testid="export-destinations-line"
      >
        <Public sx={{ fontSize: 16 }} aria-hidden />
        <Typography variant="caption">
          {t('exportItem.exportedToLine', 'Exported to: {{codes}}', {
            codes: formatExportDestinations(destinations).replace(/ · /g, ', '),
          })}
        </Typography>
      </Box>
    );
  }
  const text =
    role === 'origin'
      ? t(
          'exportItem.originLine',
          'Exported from your market. It isn’t sold here. You can still like or share it.'
        )
      : t(
          'exportItem.thirdLine',
          'Not exported to your market ({{code}}). You can still like or share it.',
          { code: marketCode?.toUpperCase() || '—' }
        );
  return (
    <Typography variant="body2" color="text.secondary" data-testid="export-viewer-note">
      {text}
    </Typography>
  );
};

export default ExportViewerNote;
