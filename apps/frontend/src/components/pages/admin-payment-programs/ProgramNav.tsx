import { List, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const PRIMARY = [
  { id: 'schedules', key: 'admin.paymentPrograms.schedules', fallback: 'Schedules' },
  { id: 'advances', key: 'admin.paymentPrograms.advances', fallback: 'Cash advances' },
  { id: 'credits', key: 'admin.paymentPrograms.credits', fallback: 'Credits' },
  { id: 'assignments', key: 'admin.paymentPrograms.assignments', fallback: 'Assignments' },
] as const;

const SUPPORTING = [
  { id: 'partners', key: 'admin.paymentPrograms.partners', fallback: 'Partners' },
  { id: 'campaigns', key: 'admin.paymentPrograms.campaigns', fallback: 'Campaigns' },
] as const;

export function ProgramNav({ section }: { section: string }) {
  const { t } = useTranslation();
  return (
    <List dense sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }} subheader={<span />}>
      <NavItem id="hub" selected={section === 'hub'} label={t('admin.paymentPrograms.title', 'Payment programs')} />
      {PRIMARY.map((item) => (
        <NavItem key={item.id} id={item.id} selected={section === item.id} label={t(item.key, item.fallback)} />
      ))}
      <ListSubheader>{t('admin.paymentPrograms.supporting', 'More')}</ListSubheader>
      {SUPPORTING.map((item) => (
        <NavItem key={item.id} id={item.id} selected={section === item.id} label={t(item.key, item.fallback)} />
      ))}
    </List>
  );
}

function NavItem({ id, selected, label }: { id: string; selected: boolean; label: string }) {
  const to = id === 'hub' ? '/admin/payment-programs' : `/admin/payment-programs/${id}`;
  return (
    <ListItemButton component={Link} to={to} selected={selected}>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}
