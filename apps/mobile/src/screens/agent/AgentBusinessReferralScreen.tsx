import React from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { AgentBusinessReferralContent } from '../../components/referrals/AgentBusinessReferralContent';

/** Standalone referred-businesses screen (Menu / Pay); Home uses AgentBusinessesHub. */
export default function AgentBusinessReferralScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + 32,
      }}
      showsVerticalScrollIndicator={false}
    >
      <AgentBusinessReferralContent />
    </ScrollView>
  );
}
