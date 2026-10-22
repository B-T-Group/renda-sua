import React, { useState, useEffect, useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  ActivityIndicator,
  Banner,
  Button,
  Card,
  Chip,
  HelperText,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import {
  extractDedicatedAgentsError,
  mapDedicatedAgentsErrorCode,
} from '../../utils/dedicatedAgentsErrors';
import { dedicatedAgentsAnalytics } from '../../services/dedicatedAgentsAnalytics';
import type { DayOfWeek, SlotKey, PickupSlot, DedicatedPostingView } from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'DedicatedPostingForm'>;

export default function DedicatedPostingFormScreen({ route, navigation }: Props) {
  const { locationId, slotKey: originatingSlot } = route.params;
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOffline } = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<SlotKey[]>([]);
  const [headcount, setHeadcount] = useState(1);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6, 7]);
  const [terms, setTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const dayLetters = [
    t('dedicatedAgents.dayLetters.monday', 'M'),
    t('dedicatedAgents.dayLetters.tuesday', 'T'),
    t('dedicatedAgents.dayLetters.wednesday', 'W'),
    t('dedicatedAgents.dayLetters.thursday', 'T'),
    t('dedicatedAgents.dayLetters.friday', 'F'),
    t('dedicatedAgents.dayLetters.saturday', 'S'),
    t('dedicatedAgents.dayLetters.sunday', 'S'),
  ];

  const loadAvailableSlots = useCallback(async () => {
    try {
      setLoading(true);
      const [slotsRes, postingsRes] = await Promise.all([
        dedicatedAgentsService.getPickupSlots(locationId),
        dedicatedAgentsService.getPostings(locationId),
      ]);

      const openPostings = postingsRes.postings.filter((p: DedicatedPostingView) => p.status === 'open');
      const slotsWithOpenPosting = new Set<SlotKey>();
      openPostings.forEach((p: DedicatedPostingView) => {
        p.slotKeys.forEach((sk: SlotKey) => slotsWithOpenPosting.add(sk));
      });

      const enabledSlotsWithoutPosting = slotsRes.slots
        .filter((s: PickupSlot) => s.isEnabled && !slotsWithOpenPosting.has(s.slotKey))
        .map((s: PickupSlot) => s.slotKey);

      setAvailableSlots(enabledSlotsWithoutPosting);

      if (originatingSlot && enabledSlotsWithoutPosting.includes(originatingSlot)) {
        setSelectedSlots([originatingSlot]);
      }

      dedicatedAgentsAnalytics.postingFormOpened({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
      });
    } catch (err: any) {
      console.error('Error loading available slots:', err);
      setError(t('dedicatedAgents.generic', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  }, [locationId, originatingSlot, t]);

  useEffect(() => {
    loadAvailableSlots();
  }, [loadAvailableSlots]);

  const handleSubmit = async () => {
    setFieldErrors({});
    setError(null);

    if (selectedSlots.length === 0) {
      setFieldErrors({
        slots: t('dedicatedAgents.errors.invalid_slot_keys', 'Please select at least one slot'),
      });
      return;
    }

    if (selectedDays.length === 0) {
      setFieldErrors({
        days: t('dedicatedAgents.errors.invalid_days_of_week', 'Please select at least one day'),
      });
      return;
    }

    if (headcount < 1 || headcount > 10) {
      setFieldErrors({
        headcount: t(
          'dedicatedAgents.errors.invalid_headcount',
          'Headcount must be between 1 and 10'
        ),
      });
      return;
    }

    try {
      setSubmitting(true);

      await dedicatedAgentsService.createPosting(locationId, {
        headcount,
        slotKeys: selectedSlots,
        daysOfWeek: selectedDays,
        terms: terms.trim() || null,
      });

      dedicatedAgentsAnalytics.postingCreated({
        platform: Platform.OS as 'ios' | 'android',
        role: 'business',
        locationId,
        headcount,
        slots: selectedSlots.length,
        days: selectedDays.length,
        termsLength: terms.trim().length,
      });

      setSnackbarMessage(t('dedicatedAgents.form.posted', 'Request posted'));
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (err: any) {
      const { code } = extractDedicatedAgentsError(err);

      if (code === 'posting_already_open') {
        const existingPostingId = err.response?.data?.posting?.id;
        if (existingPostingId) {
          navigation.replace('DedicatedApplicants', {
            locationId,
            postingId: existingPostingId,
          });
          return;
        }
      }

      if (code === 'invalid_headcount') {
        setFieldErrors({
          headcount: t(
            mapDedicatedAgentsErrorCode(code),
            'Headcount must be between 1 and 10'
          ),
        });
      } else if (code === 'invalid_slot_keys') {
        setFieldErrors({
          slots: t(mapDedicatedAgentsErrorCode(code), 'Please select at least one slot'),
        });
      } else if (code === 'invalid_days_of_week') {
        setFieldErrors({
          days: t(mapDedicatedAgentsErrorCode(code), 'Please select at least one day'),
        });
      } else if (code === 'terms_too_long') {
        setFieldErrors({
          terms: t(mapDedicatedAgentsErrorCode(code), 'Terms must be 1000 characters or less'),
        });
      } else if (code === 'slot_disabled') {
        setFieldErrors({
          slots: t(mapDedicatedAgentsErrorCode(code), 'Turn slot back on first'),
        });
      } else {
        const errorKey = code ? mapDedicatedAgentsErrorCode(code) : 'dedicatedAgents.generic';
        setError(t(errorKey, 'Something went wrong'));
      }

      console.error('Error creating posting:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background.default }]}>
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center', paddingHorizontal: spacing.lg }}>
          {t('dedicatedAgents.form.noSlotsAvailable', 'No slots available. Enable a slot or close an existing posting first.')}
        </Text>
        <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          {t('common.back', 'Back')}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
      {isOffline && (
        <Banner
          visible
          icon="wifi-off"
          style={{ backgroundColor: colors.warningTint }}
        >
          {t('dedicatedAgents.offline', 'Offline · showing last update')}
        </Banner>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl + 80 },
        ]}
      >
        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: spacing.md }}>
              {t('dedicatedAgents.form.agentsNeeded', 'Agents needed')}
            </Text>
            <View style={styles.counterRow}>
              <Button
                mode="outlined"
                onPress={() => setHeadcount(Math.max(1, headcount - 1))}
                disabled={headcount <= 1 || submitting || isOffline}
                accessibilityLabel={t('dedicatedAgents.accessibilityLabels.decreaseCount', 'Decrease count')}
              >
                −
              </Button>
              <Text variant="headlineMedium" style={{ marginHorizontal: spacing.lg }}>
                {headcount}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setHeadcount(Math.min(10, headcount + 1))}
                disabled={headcount >= 10 || submitting || isOffline}
                accessibilityLabel={t('dedicatedAgents.accessibilityLabels.increaseCount', 'Increase count')}
              >
                +
              </Button>
            </View>
            {fieldErrors.headcount && (
              <HelperText type="error">{fieldErrors.headcount}</HelperText>
            )}
          </Card.Content>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
              {t('dedicatedAgents.form.slots', 'Slots')}
            </Text>
            <View style={styles.chips}>
              {availableSlots.map((slot) => (
                <Chip
                  key={slot}
                  selected={selectedSlots.includes(slot)}
                  onPress={() => {
                    if (!submitting) {
                      setSelectedSlots((prev) =>
                        prev.includes(slot)
                          ? prev.filter((s) => s !== slot)
                          : [...prev, slot]
                      );
                    }
                  }}
                  disabled={submitting}
                  style={{ marginBottom: spacing.xs }}
                >
                  {t(`dedicatedAgents.slots.${slot}`, slot)}
                </Chip>
              ))}
            </View>
            {fieldErrors.slots && (
              <HelperText type="error">{fieldErrors.slots}</HelperText>
            )}
          </Card.Content>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
              {t('dedicatedAgents.form.days', 'Days')}
            </Text>
            <View style={styles.chips}>
              {([1, 2, 3, 4, 5, 6, 7] as DayOfWeek[]).map((day, idx) => (
                <Chip
                  key={day}
                  selected={selectedDays.includes(day)}
                  onPress={() => {
                    if (!submitting) {
                      setSelectedDays((prev) =>
                        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                      );
                    }
                  }}
                  compact
                  disabled={submitting}
                  style={{ marginBottom: spacing.xs }}
                >
                  {dayLetters[idx]}
                </Chip>
              ))}
            </View>
            {fieldErrors.days && (
              <HelperText type="error">{fieldErrors.days}</HelperText>
            )}
          </Card.Content>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              {t('dedicatedAgents.form.payLine', 'Standard delivery pay')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('dedicatedAgents.form.payFixed', '(not editable)')}
            </Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <TextInput
              label={t('dedicatedAgents.form.termsField', 'Terms / notes')}
              value={terms}
              onChangeText={(text: string) => setTerms(text.slice(0, 1000))}
              multiline
              numberOfLines={4}
              mode="outlined"
              error={!!fieldErrors.terms}
              disabled={submitting}
            />
            {fieldErrors.terms ? (
              <HelperText type="error">{fieldErrors.terms}</HelperText>
            ) : (
              <>
                <HelperText type="info">
                  {terms.length}/1000 ·{' '}
                  {t('dedicatedAgents.form.termsHelper', 'Hours, dress code, what to expect.')}
                </HelperText>
                <HelperText type="info">
                  {t('dedicatedAgents.form.termsStrip', 'Links and phone numbers are removed.')}
                </HelperText>
              </>
            )}
          </Card.Content>
        </Card>

        {error && (
          <Card style={{ marginTop: spacing.md }}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.error.main }}>
                {error}
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background.paper,
            borderTopColor: colors.divider,
          },
        ]}
      >
        <Button
          mode="contained"
          onPress={handleSubmit}
          disabled={submitting || isOffline}
          loading={submitting}
          style={{ marginHorizontal: spacing.md }}
        >
          {t('dedicatedAgents.form.publish', 'Publish')}
        </Button>
      </View>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  content: {
    padding: spacing.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
