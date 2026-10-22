import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DedicatedPostingView } from '../../../types/dedicatedAgents';

interface DedicatedPostingRowProps {
  posting: DedicatedPostingView;
  onClick: () => void;
}

const DedicatedPostingRow: React.FC<DedicatedPostingRowProps> = ({ posting, onClick }) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        p: 1.5,
        bgcolor: 'primary.light',
        borderRadius: 1,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'primary.main', color: 'primary.contrastText' },
      }}
      onClick={onClick}
    >
      <Typography variant="body2" fontWeight={600}>
        📣{' '}
        {t('dedicatedAgents.posting.row', 'Posting open · {{accepted}}/{{needed}} accepted · {{n}} new', {
          accepted: posting.acceptedCount,
          needed: posting.headcount,
          n: posting.pendingApplications,
        })}
        {' ›'}
      </Typography>
    </Box>
  );
};

export default DedicatedPostingRow;
