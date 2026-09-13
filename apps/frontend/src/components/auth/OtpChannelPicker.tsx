import EmailOutlined from '@mui/icons-material/EmailOutlined';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type OtpChannelChoice = 'email' | 'sms';

export interface OtpChannelPickerProps {
  value: OtpChannelChoice;
  onChange: (channel: OtpChannelChoice) => void;
  maskedEmail?: string;
  maskedPhone?: string;
  availableChannels: OtpChannelChoice[];
  disabled?: boolean;
}

export const OtpChannelPicker: React.FC<OtpChannelPickerProps> = ({
  value,
  onChange,
  maskedEmail,
  maskedPhone,
  availableChannels,
  disabled,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const showEmail = availableChannels.includes('email');
  const showSms = availableChannels.includes('sms');
  if (!showEmail && !showSms) return null;

  const option = (
    channel: OtpChannelChoice,
    label: string,
    hint: string,
    Icon: typeof EmailOutlined
  ) => {
    const selected = value === channel;
    return (
      <ButtonBase
        key={channel}
        disabled={disabled}
        onClick={() => onChange(channel)}
        sx={{
          flex: 1,
          textAlign: 'left',
          borderRadius: 2,
          border: 1,
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected
            ? alpha(theme.palette.primary.main, 0.08)
            : 'background.paper',
          p: 1.5,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Icon
            fontSize="small"
            color={selected ? 'primary' : 'action'}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {label}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', wordBreak: 'break-word' }}
            >
              {hint}
            </Typography>
          </Box>
        </Stack>
      </ButtonBase>
    );
  };

  return (
    <Stack spacing={1.25}>
      <Typography variant="body2" fontWeight={600}>
        {t('auth.otp.sendCodeVia', 'Send code via')}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        {showEmail
          ? option(
              'email',
              t('auth.otp.channelEmail', 'Email'),
              maskedEmail || t('auth.otp.channelEmailHint', 'Email address'),
              EmailOutlined
            )
          : null}
        {showSms
          ? option(
              'sms',
              t('auth.otp.channelSms', 'SMS'),
              maskedPhone || t('auth.otp.channelSmsHint', 'Phone number'),
              SmsOutlined
            )
          : null}
      </Stack>
    </Stack>
  );
};
