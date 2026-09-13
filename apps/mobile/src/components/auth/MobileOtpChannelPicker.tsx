import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';

export type MobileOtpChannel = 'email' | 'sms';

export interface MobileOtpChannelPickerProps {
  value: MobileOtpChannel;
  onChange: (channel: MobileOtpChannel) => void;
  availableChannels: MobileOtpChannel[];
  maskedEmail?: string;
  maskedPhone?: string;
  disabled?: boolean;
}

export function MobileOtpChannelPicker({
  value,
  onChange,
  availableChannels,
  maskedEmail,
  maskedPhone,
  disabled,
}: MobileOtpChannelPickerProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();

  const renderOption = (
    channel: MobileOtpChannel,
    label: string,
    hint: string,
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
  ) => {
    const selected = value === channel;
    return (
      <Pressable
        key={channel}
        disabled={disabled}
        onPress={() => onChange(channel)}
        style={[
          styles.option,
          {
            borderColor: selected ? colors.primary.main : colors.divider,
            backgroundColor: selected ? colors.primary.main + '14' : colors.background.paper,
            borderRadius: borderRadius.md,
            padding: spacing.md,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={selected ? colors.primary.main : colors.text.secondary}
        />
        <View style={styles.optionText}>
          <Text variant="titleSmall" style={{ color: colors.text.primary, fontWeight: '700' }}>
            {label}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {hint}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('auth.otp.sendCodeVia', 'Send code via')}
      </Text>
      {availableChannels.includes('email')
        ? renderOption(
            'email',
            t('auth.otp.channelEmail', 'Email'),
            maskedEmail || t('auth.otp.channelEmailHint', 'Email address'),
            'email-outline'
          )
        : null}
      {availableChannels.includes('sms')
        ? renderOption(
            'sms',
            t('auth.otp.channelSms', 'SMS'),
            maskedPhone || t('auth.otp.channelSmsHint', 'Phone number'),
            'message-text-outline'
          )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: { flex: 1, minWidth: 0 },
});
