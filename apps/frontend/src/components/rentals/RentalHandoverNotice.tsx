import { NotificationsNone, PanToolAltOutlined } from '@mui/icons-material';
import { Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  renterName: string;
  itemName: string;
  mode: 'push' | 'banner';
}

export function RentalHandoverNotice(props: Props) {
  const { t } = useTranslation();
  const Icon = props.mode === 'push' ? NotificationsNone : PanToolAltOutlined;
  return (
    <Stack
      direction="row"
      spacing={1.5}
      role={props.mode === 'push' ? 'alert' : 'status'}
      sx={{
        p: 2,
        borderRadius: 2,
        border: 1,
        borderColor: 'success.main',
        bgcolor: (theme) => alpha(theme.palette.success.main, props.mode === 'push' ? 0.04 : 0.12),
      }}
    >
      <Icon color="success" />
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">
          {t('rentals.business.pushStartedTitle', 'Rental started, hand over the item')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('rentals.business.pushStartedBody', '{{name}} started {{item}}. You can hand over the item.', {
            name: props.renterName,
            item: props.itemName,
          })}
        </Typography>
      </Stack>
    </Stack>
  );
}
