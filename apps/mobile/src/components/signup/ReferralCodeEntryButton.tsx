import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { AgentReferralLookupResult } from '@/hooks/useAgentReferralLookup';
import { useAgentReferralLookup } from '@/hooks/useAgentReferralLookup';
import { useTheme } from '@/contexts/ThemeContext';
import { AgentReferralCodeField } from '@/components/signup/AgentReferralCodeField';
import { ReferralCodePromptCard } from '@/components/signup/ReferralCodePromptCard';

export interface ReferralCodeEntryButtonProps {
  value: string;
  onChange: (value: string) => void;
  onVerifiedLookup?: (result: AgentReferralLookupResult | null) => void;
  disabled?: boolean;
}

export function ReferralCodeEntryButton({
  value,
  onChange,
  onVerifiedLookup,
  disabled = false,
}: ReferralCodeEntryButtonProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const {
    result: lookupResult,
    loading: lookupLoading,
    error: lookupError,
  } = useAgentReferralLookup(open ? draft : value);
  const trimmed = value.trim().toUpperCase();
  const draftTrimmed = draft.trim().toUpperCase();
  const draftReady =
    !draftTrimmed ||
    (draftTrimmed.length === 6 &&
      !!lookupResult &&
      lookupResult.agentCode.toUpperCase() === draftTrimmed &&
      !lookupLoading &&
      !lookupError);

  const handleOpen = () => {
    if (disabled) return;
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    if (!draftReady) return;
    onChange(draftTrimmed);
    onVerifiedLookup?.(lookupResult);
    setOpen(false);
  };

  const handleClear = () => {
    setDraft('');
    onChange('');
    onVerifiedLookup?.(null);
    setOpen(false);
  };

  return (
    <View style={{ marginTop: 0 }}>
      <ReferralCodePromptCard
        appliedCode={trimmed || undefined}
        disabled={disabled}
        onPress={handleOpen}
      />

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={[styles.scrim, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            onPress={() => setOpen(false)}
          >
            <Pressable
              style={[
                styles.sheet,
                shadows.md,
                {
                  backgroundColor: colors.background.paper,
                  borderRadius: borderRadius.xl,
                  maxHeight: height * 0.85,
                  paddingBottom: Math.max(insets.bottom, spacing.md),
                  paddingHorizontal: spacing.md,
                  paddingTop: spacing.lg,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: spacing.sm }}
              >
                <Text variant="titleLarge" style={{ marginBottom: spacing.md }}>
                  {t('referrals.enterCodeTitle', 'Agent referral code')}
                </Text>
                <AgentReferralCodeField
                  value={draft}
                  onChange={setDraft}
                  lookupResult={lookupResult}
                  lookupLoading={lookupLoading}
                  lookupError={lookupError}
                />
              </ScrollView>
              <View
                style={[
                  styles.actions,
                  { marginTop: spacing.lg, gap: spacing.sm },
                ]}
              >
                {trimmed || draft.trim() ? (
                  <Button mode="text" onPress={handleClear}>
                    {t('common.clear', 'Clear')}
                  </Button>
                ) : null}
                <Button mode="text" onPress={() => setOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  disabled={!draftReady || lookupLoading}
                >
                  {t('common.save', 'Save')}
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
});
