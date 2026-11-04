import { Alert, Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDesignatedFirst } from '../../hooks/useDesignatedFirst';

/** Agent dashboard entry: shows when I have designated offers or unconfirmed designated orders. */
export const AgentDesignatedBanner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { offers, upcoming } = useDesignatedFirst();
  if (!offers.length && !upcoming.length) return null;
  const pending = offers.length + upcoming.filter((u) => !u.confirmedAt).length;
  return (
    <Alert
      severity={pending ? 'info' : 'success'}
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={() => navigate('/agent/designated')}>
          {t('designatedFirst.banner.cta', 'Open')}
        </Button>
      }
    >
      {t('designatedFirst.banner.text', {
        defaultValue: 'Designated deliveries: {{offers}} offer(s), {{upcoming}} assigned.',
        offers: offers.length,
        upcoming: upcoming.length,
      })}
    </Alert>
  );
};
