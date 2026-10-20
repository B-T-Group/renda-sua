import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  Text,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import dedicatedAgentsService from '../../services/dedicatedAgentsService';
import type { DayOfWeek, SlotKey } from '../../types/dedicatedAgents';
import { spacing } from '../../theme/spacing';

type Props = NativeStackScreenProps<BusinessRootStackParamList, 'DedicatedPostingForm'>;

const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function DedicatedPostingFormScreen({ route, navigation }: Props) {
  const { locationId } = route.params;
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [headcount, setHeadcount] = useState(1);
  const [selectedSlots, setSelectedSlots] = useState<SlotKey[]>([]);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5, 6, 7]);
  const [terms, setTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSlots: SlotKey[] = ['morning', 'afternoon', 'evening'];

  const handleSubmit = async () => {
    if (selectedSlots.length === 0 || selectedDays.length === 0) {
      setError(t('common.required', 'Required'));
      return;
    }

    if (headcount < 1 || headcount > 10) {
      setError(t('common.invalid', 'Invalid'));
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await dedicatedAgentsService.createPosting(locationId, {
        headcount,
        slotKeys: selectedSlots,
        daysOfWeek: selectedDays,
        terms: terms.trim() || null,
      });

      navigation.replace('DedicatedApplicants', {
        locationId,
        postingId: response.posting.id,
      });
    } catch (err: any) {
      console.error('Error creating posting:', err);
      if (err.response?.data?.code === 'posting_already_open') {
        navigation.replace('DedicatedApplicants', {
          locationId,
          postingId: err.response.data.posting?.id,
        });
      } else {
        setError(
          err.response?.data?.message || t('dedicatedAgents.generic', 'Something went wrong')
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.default }}>
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
                disabled={headcount <= 1}
              >
                −
              </Button>
              <Text variant="headlineMedium" style={{ marginHorizontal: spacing.lg }}>
                {headcount}
              </Text>
              <Button
                mode="outlined"
                onPress={() => setHeadcount(Math.min(10, headcount + 1))}
                disabled={headcount >= 10}
              >
                +
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="titleMedium" style={{ marginBottom: spacing.sm }}>
              Slots
            </Text>
            <View style={styles.chips}>
              {allSlots.map((slot) => (
                <Chip
                  key={slot}
                  selected={selectedSlots.includes(slot)}
                  onPress={() => {
                    setSelectedSlots((prev) =>
                      prev.includes(slot)
                        ? prev.filter((s) => s !== slot)
                        : [...prev, slot]
                    );
                  }}
                  style={{ marginBottom: spacing.xs }}
                >
                  {t(`dedicatedAgents.slots.${slot}`, slot)}
                </Chip>
              ))}
            </View>
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
                    setSelectedDays((prev) =>
                      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                    );
                  }}
                  compact
                  style={{ marginBottom: spacing.xs }}
                >
                  {dayLabels[idx]}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ marginBottom: spacing.sm }}>
              {t('dedicatedAgents.form.payLine', 'Standard delivery pay')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              (fixed)
            </Text>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <TextInput
              label={t('dedicatedAgents.form.termsField', 'Terms / notes')}
              value={terms}
              onChangeText={(text) => setTerms(text.slice(0, 1000))}
              multiline
              numberOfLines={4}
              mode="outlined"
            />
            <HelperText type="info">
              {terms.length}/1000 ·{' '}
              {t('dedicatedAgents.form.termsHelper', 'Hours, dress code, what to expect.')}
            </HelperText>
            <HelperText type="info">
              {t('dedicatedAgents.form.termsStrip', 'Links and phone numbers are removed.')}
            </HelperText>
          </Card.Content>
        </Card>

        {error && (
          <Card style={{ marginTop: spacing.md, backgroundColor: colors.errorContainer }}>
            <Card.Content>
              <Text variant="bodyMedium" style={{ color: colors.error }}>
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
          disabled={submitting || selectedSlots.length === 0 || selectedDays.length === 0}
          loading={submitting}
          style={{ marginHorizontal: spacing.md }}
        >
          {t('dedicatedAgents.form.publish', 'Publish')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
