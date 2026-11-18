import { Box, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface DeclineExclusionRow {
  id: string;
  bookingId: string;
  bookingNumber: string;
  businessName: string;
  renterName: string;
  excluded: boolean;
  note: string | null;
  businessDeclines: number;
  renterDeclines: number;
}

interface DeclineExclusionPanelProps {
  rows: DeclineExclusionRow[];
  onChange: (row: DeclineExclusionRow, excluded: boolean, note: string) => void;
}

export function DeclineExclusionPanel({ rows, onChange }: DeclineExclusionPanelProps) {
  const { t } = useTranslation();
  return (
    <Stack spacing={2} data-testid="decline-exclusion">
      <Box>
        <Typography variant="h6">{t('declineRanking.title', "Not the business's fault")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('declineRanking.lead', 'Excluded declines leave the business count. They still count for the renter.')}
        </Typography>
      </Box>
      {rows.map((row) => (
        <ExclusionCard key={row.id} row={row} onChange={onChange} />
      ))}
    </Stack>
  );
}

function ExclusionCard({
  row,
  onChange,
}: {
  row: DeclineExclusionRow;
  onChange: DeclineExclusionPanelProps['onChange'];
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState(row.note ?? '');
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="subtitle1">
            {t('declineRanking.booking', 'Booking')} {row.bookingNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {row.businessName} · {row.renterName}
          </Typography>
        </Box>
        <Switch
          checked={row.excluded}
          inputProps={{ 'aria-label': t('declineRanking.title', "Not the business's fault") }}
          onChange={(_, checked) => onChange(row, checked, note)}
        />
      </Stack>
      <TextField
        fullWidth
        size="small"
        sx={{ mt: 1.5 }}
        label={t('declineRanking.note', 'Note')}
        placeholder={t('declineRanking.notePlaceholder', "Why is this not the business's fault?")}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (row.excluded && note !== (row.note ?? '')) onChange(row, true, note);
        }}
      />
      <Stack direction="row" spacing={3} sx={{ mt: 1.5 }}>
        <Count label={t('declineRanking.businessCount', 'Business declines (90 days)')} value={row.businessDeclines} />
        <Count label={t('declineRanking.renterCount', 'Renter declines (90 days)')} value={row.renterDeclines} />
      </Stack>
    </Box>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}
