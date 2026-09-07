import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, HelperText, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { AgentReferralLookupResult } from '@/hooks/useAgentReferralLookup';
import { useTheme } from '@/contexts/ThemeContext';

export interface AgentReferralCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  lookupResult: AgentReferralLookupResult | null;
  lookupLoading: boolean;
  lookupError: string | null;
}

export function AgentReferralCodeField({
  value,
  onChange,
  disabled = false,
  lookupResult,
  lookupLoading,
  lookupError,
}: AgentReferralCodeFieldProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const trimmed = value.trim().toUpperCase();
  const showLookup = trimmed.length === 6;
  const displayName = lookupResult?.firstName || lookupResult?.fullName;
  const lookupMatchesCode =
    lookupResult?.agentCode?.toUpperCase() === trimmed;

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label={t(
          'business.referrals.referralCodeLabel',
          'Agent referral code (optional)'
        )}
        value={value}
        onChangeText={(text) => onChange(text.toUpperCase())}
        maxLength={6}
        autoCapitalize="characters"
        disabled={disabled}
        left={<TextInput.Icon icon="ticket-percent-outline" />}
      />
      <HelperText type="info" visible>
        {t(
          'business.referrals.referralCodeHelp',
          'Enter the 6-character code of the Rendasua agent who referred you.'
        )}
      </HelperText>
      {showLookup && lookupLoading ? (
        <View style={styles.lookupRow}>
          <ActivityIndicator size="small" />
          <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
            {t('agent.referrals.lookupLoading', 'Looking up referral code...')}
          </Text>
        </View>
      ) : null}
      {showLookup && !lookupLoading && lookupMatchesCode && lookupResult ? (
        <HelperText type="info" visible>
          {t('agent.referrals.lookupSuccess', 'Referred by {{name}}', {
            name: displayName,
          })}
        </HelperText>
      ) : null}
      {showLookup && !lookupLoading && !lookupMatchesCode && lookupError ? (
        <HelperText type="error" visible>
          {t('agent.referrals.lookupError', 'No referrer found for this code')}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
});
