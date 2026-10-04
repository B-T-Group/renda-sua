import { Box, Button, Card, CardContent, LinearProgress, Skeleton, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import type { ScheduleAssignmentDetail } from '../../hooks/usePaymentScheduleDetail';
import {
  formatObjectivePair,
  objectiveGapLabel,
  objectiveRowMeta,
} from '../accounts/ObjectiveProgressList';
import { ObjectiveProgressRing } from '../accounts/ObjectiveProgressRing';

interface FocusResponse {
  assignment: ScheduleAssignmentDetail | null;
  otherCount: number;
}

export function AgentObjectiveFocusCard() {
  const focus = useObjectiveFocus();
  if (focus.loading) return <Skeleton variant="rounded" height={148} sx={{ mb: 2 }} />;
  if (!focus.assignment) return null;
  return <FocusBody assignment={focus.assignment} otherCount={focus.otherCount} />;
}

function useObjectiveFocus() {
  const api = useApiClient();
  const [assignment, setAssignment] = useState<ScheduleAssignmentDetail | null>(null);
  const [otherCount, setOtherCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api
      .get('/payment-programs/schedules/focus')
      .then((response) => {
        if (cancelled) return;
        const body = (response.data ?? {}) as FocusResponse;
        setAssignment(body.assignment ?? null);
        setOtherCount(body.otherCount ?? 0);
      })
      .catch(() => {
        if (!cancelled) setAssignment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  return { assignment, otherCount, loading };
}

function FocusBody({
  assignment,
  otherCount,
}: {
  assignment: ScheduleAssignmentDetail;
  otherCount: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const nextKey = assignment.progress.nextObjective;
  const next = nextKey ? assignment.progress[nextKey] : null;
  const meta = nextKey ? objectiveRowMeta(nextKey) : undefined;
  const overall = assignment.progress.overallPercent ?? 0;
  const openPlan = () => navigate(`/accounts/schedules/${assignment.id}`);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1.5 }}>
          <ObjectiveProgressRing
            percent={overall}
            label={t('accounts.schedules.focus.overall', '{{percent}}% overall', {
              percent: overall,
            })}
          />
          <Box>
            <Typography variant="subtitle1">{assignment.schedule.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('accounts.schedules.focus.overall', '{{percent}}% overall', { percent: overall })}
            </Typography>
          </Box>
        </Box>
        <FocusHeadline assignment={assignment} />
        {next && meta && next.percent != null ? (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {formatObjectivePair(next.actual, next.target ?? 0, meta.money, assignment.currency)}
            </Typography>
            <LinearProgress variant="determinate" value={next.percent} />
          </Box>
        ) : null}
        <Button size="small" sx={{ mt: 1, px: 0 }} onClick={openPlan}>
          {t('accounts.schedules.focus.seeAll', 'See all objectives')}
        </Button>
        {otherCount > 0 ? (
          <Button size="small" sx={{ display: 'block', px: 0 }} onClick={() => navigate('/accounts/schedules')}>
            {otherPlansLabel(otherCount, t)}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FocusHeadline({ assignment }: { assignment: ScheduleAssignmentDetail }) {
  const { t } = useTranslation();
  const nextKey = assignment.progress.nextObjective;
  if (!nextKey) {
    return (
      <Typography variant="h6">
        {t(
          'accounts.schedules.focus.allMet',
          "You've met every objective on this plan."
        )}
      </Typography>
    );
  }
  return (
    <Typography variant="h6">
      {objectiveGapLabel(nextKey, assignment.progress[nextKey], assignment.currency, t)}
    </Typography>
  );
}

function otherPlansLabel(
  count: number,
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string
) {
  if (count === 1) {
    return t('accounts.schedules.focus.otherPlan', 'You have another plan');
  }
  return t('accounts.schedules.focus.otherPlans', 'You have {{count}} other plans', { count });
}
