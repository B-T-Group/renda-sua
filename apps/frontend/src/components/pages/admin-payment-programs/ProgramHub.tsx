import { Card, CardActionArea, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AdvanceArt, AssignmentArt, CreditArt, ScheduleArt } from './ProgramArt';

export function ProgramHub() {
  const { t } = useTranslation();
  const cards = [
    {
      to: '/admin/payment-programs/schedules',
      title: t('admin.paymentPrograms.schedules', 'Schedules'),
      body: t('admin.paymentPrograms.hubSchedules', 'A schedule is a stipend template. It pays nobody until you assign it.'),
      art: ScheduleArt,
    },
    {
      to: '/admin/payment-programs/advances',
      title: t('admin.paymentPrograms.advances', 'Cash advances'),
      body: t('admin.paymentPrograms.hubAdvances', 'A cash-advance program sets the limit an agent can draw. Opening a line is a separate step.'),
      art: AdvanceArt,
    },
    {
      to: '/admin/payment-programs/credits',
      title: t('admin.paymentPrograms.credits', 'Credits'),
      body: t('admin.paymentPrograms.hubCredits', 'Store credit is spent at checkout. It is not cash and cannot be withdrawn.'),
      art: CreditArt,
    },
    {
      to: '/admin/payment-programs/assignments',
      title: t('admin.paymentPrograms.assignments', 'Assignments'),
      body: t('admin.paymentPrograms.hubAssignments', 'An assignment applies an existing schedule or cash-advance program to one agent.'),
      art: AssignmentArt,
    },
  ];
  return (
    <Stack spacing={2}>
      <Typography variant="h4">{t('admin.paymentPrograms.title', 'Payment programs')}</Typography>
      <Typography color="text.secondary">
        {t('admin.paymentPrograms.hubLead', 'Define a template first. Assign it only when you are ready to pay someone.')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={2}>
        {cards.map((card) => (
          <HubCard key={card.to} {...card} />
        ))}
      </Stack>
    </Stack>
  );
}

function HubCard({
  to,
  title,
  body,
  art: Art,
}: {
  to: string;
  title: string;
  body: string;
  art: (props: { label: string }) => React.ReactElement;
}) {
  return (
    <Card sx={{ width: { xs: '100%', sm: 280 } }}>
      <CardActionArea component={Link} to={to}>
        <CardContent>
          <Art label={title} />
          <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{body}</Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
