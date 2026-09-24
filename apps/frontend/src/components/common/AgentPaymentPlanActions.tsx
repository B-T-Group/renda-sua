import { Alert, Button, Card, CardContent, Skeleton, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

interface ActionItem {
  id: string;
  kind: string;
  priority: string;
  count: number;
  primaryId?: string;
  primaryLabel?: string;
}

export function AgentPaymentPlanActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const api = useApiClient();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void api
      .get('/dashboard/actions')
      .then((response) => {
        if (cancelled) return;
        const actions = (response.data?.data?.actions ??
          response.data?.actions ??
          []) as ActionItem[];
        setItems(actions.filter((row) => row.kind === 'payment_plan_pending'));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (loading) return <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />;
  if (!items.length) return null;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('accounts.schedules.pendingTitle', 'Payment plan awaiting your response')}
        </Typography>
        {items.map((item) => (
          <Alert
            key={item.id}
            severity="warning"
            sx={{ mb: 1 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  navigate(`/accounts/schedules/${item.primaryId}`)
                }
              >
                {t('accounts.schedules.review', 'Review')}
              </Button>
            }
          >
            {item.primaryLabel ||
              t('accounts.schedules.pendingPlan', 'A payment plan needs your decision')}
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
