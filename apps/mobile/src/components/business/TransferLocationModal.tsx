import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Button,
  IconButton,
  Text,
  TextInput,
} from 'react-native-paper';
import { AppModal } from '../common/AppModal';
import { StatusPill } from '../common/StatusPill';
import { LocationTransferVector } from '../illustrations/LocationTransferVector';
import { useTheme } from '../../contexts/ThemeContext';
import { useLocationTransfers } from '../../hooks/business/useLocationTransfers';
import type { BusinessLocation } from '../../types/business/locations';
import type {
  TransferBusinessOption,
  TransferMode,
  TransferPreview,
} from '../../types/business/locationTransfer';
import { transferBlockReasonKey } from '../../utils/locationTransferBlockReasons';
import { spacing } from '../../theme/spacing';

type Step = 0 | 1 | 2 | 3;

type Props = {
  visible: boolean;
  location: BusinessLocation | null;
  businessId?: string;
  onDismiss: () => void;
  onSuccess: () => void;
};

const STEP_KEYS: [string, string][] = [
  ['business.locations.transfer.stepSelect', 'Select business'],
  ['business.locations.transfer.stepMode', 'Transfer type'],
  ['business.locations.transfer.stepSummary', 'Summary'],
  ['business.locations.transfer.stepConfirm', 'Confirm'],
];

function ModeChoiceCard({
  selected,
  title,
  description,
  onPress,
}: {
  selected: boolean;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeCard,
        {
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected
            ? `${colors.primary.main}14`
            : colors.surface,
          borderRadius: borderRadius.card,
        },
      ]}
    >
      <Text
        variant="titleSmall"
        style={{ color: colors.text.primary, fontWeight: '700' }}
      >
        {title}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {description}
      </Text>
    </Pressable>
  );
}

function StepDots({ step }: { step: Step }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.stepsRow}>
      {STEP_KEYS.map(([key, fallback], i) => {
        const active = i === step;
        const done = i < step;
        return (
          <View key={key} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor:
                    active || done ? colors.primary.main : colors.divider,
                },
              ]}
            />
            <Text
              variant="labelSmall"
              style={{
                color: active ? colors.primary.main : colors.text.secondary,
                fontWeight: active ? '700' : '400',
              }}
              numberOfLines={1}
            >
              {t(key, fallback)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BusinessResultRow({
  option,
  selected,
  onPress,
}: {
  option: TransferBusinessOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.resultRow,
        {
          borderColor: selected ? colors.primary.main : colors.divider,
          backgroundColor: selected
            ? `${colors.primary.main}14`
            : colors.surface,
          borderRadius: borderRadius.sm,
        },
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }} numberOfLines={2}>
        {option.name}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }} numberOfLines={1}>
        {option.email}
      </Text>
    </Pressable>
  );
}

export function TransferLocationModal({
  visible,
  location,
  businessId,
  onDismiss,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const {
    searchBusinesses,
    listDestLocations,
    previewTransfer,
    createRequest,
  } = useLocationTransfers(businessId);

  const [step, setStep] = useState<Step>(0);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<TransferBusinessOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<TransferBusinessOption | null>(null);
  const [mode, setMode] = useState<TransferMode>('location_ownership');
  const [destLocations, setDestLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [toLocationId, setToLocationId] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setStep(0);
    setDone(false);
    setSearch('');
    setOptions([]);
    setSelected(null);
    setMode('location_ownership');
    setDestLocations([]);
    setToLocationId('');
    setPreview(null);
    setConfirmName('');
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  useEffect(() => {
    if (!visible || done || step !== 0) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) {
      setOptions([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      void searchBusinesses(search)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, visible, done, step, searchBusinesses]);

  useEffect(() => {
    if (!visible || done || step !== 1 || !selected || mode !== 'inventory_merge') {
      return;
    }
    setLocationsLoading(true);
    void listDestLocations(selected.id)
      .then((locs) => {
        setDestLocations(locs);
        setToLocationId((prev) =>
          prev && locs.some((l) => l.id === prev) ? prev : locs[0]?.id || ''
        );
      })
      .catch(() => {
        setDestLocations([]);
        setToLocationId('');
      })
      .finally(() => setLocationsLoading(false));
  }, [visible, done, step, selected, mode, listDestLocations]);

  const goPreview = async () => {
    if (!location || !selected) return;
    if (mode === 'inventory_merge' && !toLocationId) {
      setError(
        t(
          'business.locations.transfer.destLocationRequired',
          'Select a destination location'
        )
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPreview(
        await previewTransfer(location.id, selected.id, {
          mode,
          toLocationId: mode === 'inventory_merge' ? toLocationId : undefined,
        })
      );
      setStep(2);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? t('common.error', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!location || !selected || !preview?.canTransfer) return;
    setLoading(true);
    setError(null);
    try {
      await createRequest(location.id, selected.id, confirmName, {
        mode,
        toLocationId: mode === 'inventory_merge' ? toLocationId : undefined,
      });
      setDone(true);
      onSuccess();
    } catch (err: unknown) {
      setError((err as Error)?.message ?? t('common.error', 'Something went wrong'));
    } finally {
      setLoading(false);
    }
  };

  const nameMatches =
    !!preview &&
    confirmName.trim().toLowerCase() ===
      preview.toBusiness.name.trim().toLowerCase();

  const sendLabel =
    mode === 'inventory_merge'
      ? t(
          'business.locations.transfer.sendMergeRequest',
          'Send inventory merge request'
        )
      : t(
          'business.locations.transfer.sendOwnershipRequest',
          'Send ownership transfer'
        );

  return (
    <AppModal visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View
        style={[
          styles.sheet,
          {
            width,
            height,
            paddingTop: insets.top,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            backgroundColor: colors.pageBackground,
          },
        ]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <IconButton icon="close" onPress={onDismiss} disabled={loading} />
            <Text
              variant="titleMedium"
              style={[styles.headerTitle, { color: colors.text.primary }]}
            >
              {done
                ? t('business.locations.transfer.successTitle', 'Request sent')
                : t('business.locations.transfer.title', 'Transfer location')}
            </Text>
            <View style={{ width: 48 }} />
          </View>

          {!done ? <StepDots step={step} /> : null}

          {error && !done ? (
            <Text style={[styles.error, { color: colors.error.main }]}>{error}</Text>
          ) : null}

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {done ? (
              <View style={[styles.stepBody, { alignItems: 'center' }]}>
                <LocationTransferVector size={128} />
                <Text
                  variant="titleMedium"
                  style={{ color: colors.text.primary, fontWeight: '700', textAlign: 'center' }}
                >
                  {t('business.locations.transfer.successTitle', 'Request sent')}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, textAlign: 'center' }}
                >
                  {t(
                    'business.locations.transfer.successPendingOn',
                    'Pending on {{name}}. They can accept or reject from their locations screen.',
                    { name: selected?.name || preview?.toBusiness.name || '' }
                  )}
                </Text>
              </View>
            ) : null}

            {!done && step === 0 ? (
              <View style={styles.stepBody}>
                <LocationTransferVector size={112} />
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, textAlign: 'center' }}
                >
                  {t(
                    'business.locations.transfer.selectHint',
                    'Search for the business that should receive "{{name}}".',
                    { name: location?.name ?? '' }
                  )}
                </Text>
                <TextInput
                  mode="outlined"
                  label={t(
                    'business.locations.transfer.searchLabel',
                    'Business name or email'
                  )}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  right={
                    searchLoading ? (
                      <TextInput.Icon
                        icon={() => <ActivityIndicator size={18} />}
                      />
                    ) : undefined
                  }
                />
                <View style={{ gap: spacing.xs }}>
                  {options.map((item) => (
                    <BusinessResultRow
                      key={item.id}
                      option={item}
                      selected={selected?.id === item.id}
                      onPress={() => setSelected(item)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {!done && step === 1 ? (
              <View style={styles.stepBody}>
                <Text
                  variant="bodyMedium"
                  style={{ color: colors.text.secondary, textAlign: 'center' }}
                >
                  {t(
                    'business.locations.transfer.modeHint',
                    'Choose whether to move the whole location or only its inventory.'
                  )}
                </Text>
                <ModeChoiceCard
                  selected={mode === 'location_ownership'}
                  title={t(
                    'business.locations.transfer.modeOwnershipTitle',
                    'Transfer ownership'
                  )}
                  description={t(
                    'business.locations.transfer.modeOwnershipBody',
                    'Move the entire location—including address, inventory, and account—to the other business.'
                  )}
                  onPress={() => setMode('location_ownership')}
                />
                <ModeChoiceCard
                  selected={mode === 'inventory_merge'}
                  title={t(
                    'business.locations.transfer.modeMergeTitle',
                    'Merge inventory'
                  )}
                  description={t(
                    'business.locations.transfer.modeMergeBody',
                    'Keep your location. Move eligible stock into one of their existing locations.'
                  )}
                  onPress={() => setMode('inventory_merge')}
                />
                {mode === 'inventory_merge' ? (
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="labelLarge" style={{ color: colors.text.primary }}>
                      {t(
                        'business.locations.transfer.destLocation',
                        'Destination location'
                      )}
                    </Text>
                    {locationsLoading ? <ActivityIndicator /> : null}
                    {!locationsLoading && destLocations.length === 0 ? (
                      <Text style={{ color: colors.text.secondary }}>
                        {t(
                          'business.locations.transfer.noDestLocations',
                          'This business has no active locations'
                        )}
                      </Text>
                    ) : null}
                    {destLocations.map((loc) => (
                      <Pressable
                        key={loc.id}
                        onPress={() => setToLocationId(loc.id)}
                        style={[
                          styles.resultRow,
                          {
                            borderColor:
                              toLocationId === loc.id
                                ? colors.primary.main
                                : colors.divider,
                            backgroundColor:
                              toLocationId === loc.id
                                ? `${colors.primary.main}14`
                                : colors.surface,
                            borderRadius: 8,
                          },
                        ]}
                      >
                        <Text variant="titleSmall">{loc.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!done && step === 2 && preview ? (
              <View style={styles.stepBody}>
                {!preview.canTransfer ? (
                  <View
                    style={[
                      styles.blockBox,
                      {
                        backgroundColor: `${colors.warning.main}18`,
                        borderColor: colors.warning.main,
                      },
                    ]}
                  >
                    {(preview.blockReasons || []).map((code) => {
                      const [key, fallback] = transferBlockReasonKey(code);
                      return (
                        <Text
                          key={code}
                          variant="bodySmall"
                          style={{ color: colors.text.primary, marginTop: 4 }}
                        >
                          • {t(key, fallback)}
                        </Text>
                      );
                    })}
                  </View>
                ) : (
                  <StatusPill
                    label={t(
                      'business.locations.transfer.readyBadge',
                      'Ready to transfer'
                    )}
                    backgroundColor={`${colors.success.main}24`}
                    textColor={colors.success.dark}
                  />
                )}
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {preview.mode === 'inventory_merge'
                    ? t(
                        'business.locations.transfer.modeMergeBadge',
                        'Inventory merge'
                      )
                    : t(
                        'business.locations.transfer.modeOwnershipBadge',
                        'Location ownership'
                      )}
                </Text>
                <Text variant="titleMedium" style={{ color: colors.text.primary }}>
                  {preview.locationName}
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                  {preview.mode === 'inventory_merge'
                    ? t(
                        'business.locations.transfer.mergeSummaryLine',
                        '{{items}} items · {{rentals}} rentals will move · {{skipped}} skipped',
                        {
                          items: preview.movableItemCount,
                          rentals: preview.movableRentalItemCount,
                          skipped:
                            preview.skippedDuplicateCount +
                            preview.skippedSharedCount,
                        }
                      )
                    : t(
                        'business.locations.transfer.summaryLine',
                        '1 location · {{items}} items · {{rentals}} rentals · {{orders}} completed orders',
                        {
                          items: preview.itemCount,
                          rentals: preview.rentalItemCount,
                          orders: preview.completedOrderCount,
                        }
                      )}
                </Text>
                {preview.toLocation ? (
                  <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                    {t(
                      'business.locations.transfer.toLocationLine',
                      'Destination location: {{name}}',
                      { name: preview.toLocation.name }
                    )}
                  </Text>
                ) : null}
                {(preview.skippedDuplicates || []).map((item) => (
                  <Text
                    key={item.itemId}
                    variant="bodySmall"
                    style={{ color: colors.warning.dark }}
                  >
                    {t(
                      'business.locations.transfer.skippedDuplicateItem',
                      'Skipped duplicate: {{name}}',
                      { name: item.name }
                    )}
                  </Text>
                ))}
                {(preview.skippedShared || []).map((item) => (
                  <Text
                    key={item.itemId}
                    variant="bodySmall"
                    style={{ color: colors.warning.dark }}
                  >
                    {t(
                      'business.locations.transfer.skippedSharedItem',
                      'Skipped shared: {{name}}',
                      { name: item.name }
                    )}
                  </Text>
                ))}
              </View>
            ) : null}

            {!done && step === 3 && preview ? (
              <View style={styles.stepBody}>
                <Text variant="bodyMedium" style={{ color: colors.text.secondary }}>
                  {t(
                    'business.locations.transfer.confirmHint',
                    'Type the destination business name "{{name}}" to send the transfer request.',
                    { name: preview.toBusiness.name }
                  )}
                </Text>
                <TextInput
                  mode="outlined"
                  label={t(
                    'business.locations.transfer.confirmLabel',
                    'Destination business name'
                  )}
                  value={confirmName}
                  onChangeText={setConfirmName}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: colors.divider, paddingHorizontal: spacing.md },
            ]}
          >
            {done ? (
              <Button mode="contained" onPress={onDismiss} style={{ flex: 1 }}>
                {t('common.done', 'Done')}
              </Button>
            ) : (
              <>
                {step > 0 ? (
                  <Button
                    mode="text"
                    onPress={() => setStep((s) => (s - 1) as Step)}
                    disabled={loading}
                  >
                    {t('common.back', 'Back')}
                  </Button>
                ) : (
                  <Button mode="text" onPress={onDismiss} disabled={loading}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                )}
                {step === 0 ? (
                  <Button
                    mode="contained"
                    onPress={() => setStep(1)}
                    disabled={!selected}
                  >
                    {t('common.next', 'Next')}
                  </Button>
                ) : null}
                {step === 1 ? (
                  <Button
                    mode="contained"
                    onPress={() => void goPreview()}
                    loading={loading}
                    disabled={
                      loading ||
                      (mode === 'inventory_merge' &&
                        (!toLocationId || locationsLoading))
                    }
                  >
                    {t('common.next', 'Next')}
                  </Button>
                ) : null}
                {step === 2 ? (
                  <Button
                    mode="contained"
                    onPress={() => setStep(3)}
                    disabled={!preview?.canTransfer}
                  >
                    {t('common.next', 'Next')}
                  </Button>
                ) : null}
                {step === 3 ? (
                  <Button
                    mode="contained"
                    onPress={() => void submit()}
                    loading={loading}
                    disabled={!nameMatches || loading}
                  >
                    {sendLabel}
                  </Button>
                ) : null}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700' },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  stepItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  stepBody: { gap: spacing.md },
  error: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  resultRow: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    gap: 2,
  },
  modeCard: {
    borderWidth: 2,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
