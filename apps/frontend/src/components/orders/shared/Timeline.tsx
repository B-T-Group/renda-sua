import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from './StatusBadge';

export interface TimelineEntry {
  id: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  actorLabel?: string | null;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  title?: string;
  emptyLabel?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  entries,
  title,
  emptyLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          {title ?? t('orders.timeline.title', 'Timeline')}
        </Typography>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel ?? t('orders.timeline.empty', 'No history yet')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {entries.map((entry, index) => (
              <Box
                key={entry.id}
                sx={{
                  display: 'flex',
                  gap: 2,
                  borderLeft: index < entries.length - 1 ? 2 : 0,
                  borderColor: 'divider',
                  pl: 2,
                  pb: 1,
                }}
              >
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StatusBadge status={entry.status} />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(entry.createdAt).toLocaleString()}
                    </Typography>
                  </Stack>
                  {entry.actorLabel ? (
                    <Typography variant="caption" color="text.secondary">
                      {entry.actorLabel}
                    </Typography>
                  ) : null}
                  {entry.notes ? (
                    <Typography variant="body2">{entry.notes}</Typography>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default Timeline;
