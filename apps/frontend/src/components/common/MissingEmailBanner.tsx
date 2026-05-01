import EmailOutlined from '@mui/icons-material/EmailOutlined';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface MissingEmailBannerProps {
  /** Opens the add-email dialog */
  onAddEmail: () => void;
  severity?: 'info' | 'warning';
}

const MissingEmailBanner: React.FC<MissingEmailBannerProps> = ({
  onAddEmail,
  severity = 'info',
}) => {
  const { t } = useTranslation();
  return (
    <Alert
      severity={severity}
      icon={<EmailOutlined fontSize="inherit" />}
      sx={{ borderRadius: 2, alignItems: 'flex-start' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <Box>
          <AlertTitle sx={{ mb: 0.5 }}>
            {t(
              'orders.optionalEmail.bannerTitle',
              'Add your email for order updates'
            )}
          </AlertTitle>
          {t(
            'orders.optionalEmail.bannerBody',
            'We recommend adding an email so you can receive receipts and status updates about your orders.'
          )}
        </Box>
        <Button
          variant={severity === 'warning' ? 'contained' : 'outlined'}
          color={severity === 'warning' ? 'warning' : 'primary'}
          size="small"
          onClick={onAddEmail}
          startIcon={<EmailOutlined />}
          sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          {t('orders.optionalEmail.addEmail', 'Add email')}
        </Button>
      </Box>
    </Alert>
  );
};

export default MissingEmailBanner;
