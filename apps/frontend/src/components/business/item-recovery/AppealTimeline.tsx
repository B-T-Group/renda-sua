import { Box, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ItemAppeal } from '../../../types/itemRejectionRecovery';
import { RejectionReasonBlock } from './RejectionReasonBlock';

type Props = {
  appeal: ItemAppeal;
  translationAvailable?: boolean;
  onTranslate?: (text: string) => Promise<string | null>;
};

export function AppealTimeline({
  appeal,
  translationAvailable,
  onTranslate,
}: Props) {
  const { t } = useTranslation();
  const steps = timelineSteps(appeal.status);

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {steps.map((step) => (
          <Box
            key={step.id}
            sx={{
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: step.active ? 'warning.light' : 'action.hover',
              color: step.active ? 'warning.contrastText' : 'text.secondary',
            }}
          >
            <Typography variant="caption" fontWeight={step.active ? 700 : 500}>
              {t(step.key, step.label)}
            </Typography>
          </Box>
        ))}
      </Stack>
      {appeal.adminNote ? (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('business.items.recovery.appeal.adminNote', 'Reviewer note')}
          </Typography>
          <RejectionReasonBlock
            text={appeal.adminNote}
            translationAvailable={translationAvailable}
            onTranslate={onTranslate}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function timelineSteps(status: ItemAppeal['status']) {
  return [
    {
      id: 'pending',
      key: 'business.items.recovery.appeal.pending',
      label: 'Appeal pending',
      active: status === 'pending',
    },
    {
      id: 'upheld',
      key: 'business.items.recovery.appeal.upheld',
      label: 'Decision upheld',
      active: status === 'upheld',
    },
    {
      id: 'overturned',
      key: 'business.items.recovery.appeal.overturned',
      label: 'Decision overturned, your item is live',
      active: status === 'overturned',
    },
  ];
}
