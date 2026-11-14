import { Box, Button, Stack, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LensIcon from '@mui/icons-material/Lens';
import { useTranslation } from 'react-i18next';

export interface SentPhoto {
  id: string;
  role: string;
  url?: string;
}

const PHOTO_ROLES = ['overview', 'other_side', 'accessories'] as const;
const ACCENT = '#0B7A3B';

export function ReportSentConfirmation({
  stage,
  renterName,
  unitCount,
  versionNo,
  when,
  photos,
  canEdit,
  onBack,
  onEdit,
}: {
  stage: 'pickup' | 'return';
  renterName: string;
  unitCount: number;
  versionNo: number;
  when: string;
  photos: SentPhoto[];
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const leadKey = stage === 'return' ? 'rentalInspection.confirm.sentLeadReturn' : 'rentalInspection.confirm.sentLead';
  const leadDefault = stage === 'return'
    ? 'We asked {{name}} to review the return. The rental stays open until they accept.'
    : 'We asked {{name}} to review it. Hand over the item once they accept. The rental starts automatically.';
  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="caption" color="text.secondary">{t('rentalInspection.confirm.pageTitle', 'Confirmation')}</Typography>
      <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: `${ACCENT}18`, display: 'grid', placeItems: 'center', mt: 1.5 }}>
        <CheckIcon sx={{ color: ACCENT }} />
      </Box>
      <Typography variant="h5" fontWeight={800} sx={{ mt: 1.5 }}>
        {t('rentalInspection.confirm.sentTitle', 'Condition report sent')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {t(leadKey, leadDefault, { name: renterName })}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {t('rentalInspection.confirm.unitLine', '{{count}} unit · v{{version}} · {{when}}', { count: unitCount, version: versionNo, when })}
      </Typography>
      <PhotoStrip photos={photos} />
      <SentSteps stage={stage} />
      <Button variant="contained" onClick={onBack} sx={{ mt: 3, bgcolor: ACCENT, minHeight: 48, '&:hover': { bgcolor: ACCENT } }}>
        {t('rentalInspection.confirm.backToBooking', 'Back to booking')}
      </Button>
      {canEdit ? (
        <Button startIcon={<EditOutlinedIcon />} onClick={onEdit} sx={{ display: 'flex', mt: 1, color: ACCENT }}>
          {t('rentalInspection.confirm.editReport', 'Edit report')}
        </Button>
      ) : null}
    </Box>
  );
}

function PhotoStrip({ photos }: { photos: SentPhoto[] }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
      {PHOTO_ROLES.map((role) => {
        const photo = photos.find((row) => row.role === role);
        const label = t(`rentalInspection.${role === 'other_side' ? 'otherSide' : role}`, role);
        return (
          <Box key={role} sx={{ flex: 1 }}>
            <Box sx={{ height: 72, borderRadius: 1, bgcolor: 'divider', backgroundImage: photo?.url ? `url(${photo.url})` : undefined, backgroundSize: 'cover' }} />
            <Typography variant="caption" color="text.secondary">{label}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

function SentSteps({ stage }: { stage: 'pickup' | 'return' }) {
  const { t } = useTranslation();
  const last = stage === 'return'
    ? t('rentalInspection.confirm.stepCloses', 'Return closes')
    : t('rentalInspection.confirm.stepStarts', 'Rental starts');
  const steps = [
    { label: t('rentalInspection.confirm.stepSent', 'Report sent'), state: 'done' as const },
    { label: t('rentalInspection.confirm.stepReview', 'Renter reviews'), state: 'current' as const },
    { label: last, state: 'later' as const },
  ];
  return (
    <Stack spacing={0.5} sx={{ mt: 3 }}>
      {steps.map((step) => (
        <Stack key={step.label} direction="row" spacing={1} alignItems="center">
          <StepIcon state={step.state} />
          <Typography variant="body2" fontWeight={step.state === 'current' ? 700 : 400} color={step.state === 'later' ? 'text.disabled' : 'text.primary'}>
            {step.label}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function StepIcon({ state }: { state: 'done' | 'current' | 'later' }) {
  if (state === 'current') return <LensIcon sx={{ fontSize: 16, color: ACCENT }} />;
  if (state === 'done') return <CheckCircleIcon sx={{ fontSize: 18, color: ACCENT }} />;
  return <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />;
}
