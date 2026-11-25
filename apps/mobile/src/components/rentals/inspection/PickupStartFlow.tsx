import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import type { InspectionPhoto, InspectionView } from '../../../utils/rentals/rentalInspection';
import { listingCity } from '../../../utils/rentals/pickupPhotoTime';
import { splitCorrectionReason } from '../../../utils/rentals/rentalInspection';
import { formatPhotoStamp, formatZonedTime, pickupPhase } from '../../../utils/rentals/rentalStartWindow';

const REASON_ORDER = ['photo_mismatch', 'wear_hidden', 'missing_accessory', 'wrong_unit'] as const;

interface Props {
  view: InspectionView;
  photos: InspectionPhoto[];
  timeZone: string;
  place: string;
  returnLabel: string;
  money: string;
  startAt: string;
  endAt: string;
  startOpensAt?: string | null;
  busy: boolean;
  starting: boolean;
  showDecline: boolean;
  itemName?: string;
  bookingNumber?: string;
  onMatch: () => void;
  onAsk: (reasons: string[], note: string) => void;
  onDecline: () => void;
  onStart: () => void;
  onReport: () => void;
}

export function PickupStartFlow(props: Props) {
  const waiting = props.view.status === 'correction_requested';
  const checked = props.view.yourDecision === 'accept';
  const step = waiting ? 'wait' : checked ? 'start' : 'check';
  return (
    <FlowFrame step={step} name={props.itemName} number={props.bookingNumber} business={props.place}>
      {step === 'wait' ? <Waiting {...props} /> : null}
      {step !== 'wait' ? <PhotoRow photos={props.photos} timeZone={props.timeZone} /> : null}
      {step === 'check' ? <CheckActions {...props} /> : null}
      {step === 'start' ? <StartStep {...props} /> : null}
      {step === 'wait' ? <PhotoRow photos={props.photos} timeZone={props.timeZone} /> : null}
      {step === 'wait' ? <LockedStart /> : null}
    </FlowFrame>
  );
}

function FlowFrame({ step, name, number, business, children }: { step: string; name?: string; number?: string; business?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBackground }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24, gap: spacing.md }}>
        <ItemHeader name={name} number={number} business={business} />
        <Stepper step={step} />
        {step === 'check' ? (
          <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 18 }}>
            {t('rentalInspection.matchesQuestion', 'Do the photos match the item in front of you?')}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

function ItemHeader(props: { name?: string; number?: string; business?: string }) {
  const { colors } = useTheme();
  if (!props.name) return null;
  const meta = [props.number, props.business].filter(Boolean).join(' · ');
  return (
    <View>
      <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 18 }}>{props.name}</Text>
      {meta ? <Text style={{ color: colors.text.secondary }}>{meta}</Text> : null}
    </View>
  );
}

function Stepper({ step }: { step: string }) {
  const { t } = useTranslation();
  const current = step === 'start' ? 2 : 1;
  return (
    <View style={styles.stepper}>
      <StepDot n={1} label={t('rentalInspection.stepCheck', 'Check the item')} on={current === 1} done={step === 'start'} />
      <View style={styles.stepLine} />
      <StepDot n={2} label={t('rentalInspection.stepStart', 'Start rental')} on={current === 2} done={false} />
    </View>
  );
}

function StepDot({ n, label, on, done }: { n: number; label: string; on: boolean; done: boolean }) {
  const { colors } = useTheme();
  const tone = done ? colors.success.main : on ? colors.primary.main : colors.text.disabled;
  return (
    <View style={styles.stepDot}>
      <View style={[styles.circle, { borderColor: tone, backgroundColor: done || on ? tone : 'transparent' }]}>
        <Text style={{ color: done || on ? '#fff' : tone, fontWeight: '700' }}>{done ? '✓' : String(n)}</Text>
      </View>
      <Text style={{ color: tone, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function PhotoRow({ photos, timeZone }: { photos: InspectionPhoto[]; timeZone: string }) {
  const { i18n } = useTranslation();
  return (
    <View style={styles.photos}>
      {photos.map((photo) => (
        <PhotoTile key={photo.id} photo={photo} timeZone={timeZone} language={i18n.language} />
      ))}
    </View>
  );
}

function PhotoTile({ photo, timeZone, language }: { photo: InspectionPhoto; timeZone: string; language: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const badge = photo.reused ? t('rentalInspection.reusedBadge', 'Reused') : t('rentalInspection.newBadge', 'New');
  const when = photo.capturedAt ? formatPhotoStamp(photo.capturedAt, timeZone, language) : '';
  return (
    <View style={styles.tile}>
      <View style={[styles.frame, { backgroundColor: colors.surfaceInput }]}>
        {photo.url ? <Image source={{ uri: photo.url }} style={styles.image} /> : null}
      </View>
      <Text style={{ textAlign: 'center', color: colors.text.primary }}>{roleLabel(photo.role, t)}</Text>
      <Text style={{ textAlign: 'center', color: colors.text.secondary, fontSize: 11 }}>{`${badge}${when ? ` · ${when}` : ''}`}</Text>
    </View>
  );
}

function CheckActions(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <ReuseNote photos={props.photos} timeZone={props.timeZone} />
      <Button mode="contained" icon="check" buttonColor={colors.primary.main} loading={props.busy} onPress={props.onMatch}>
        {t('rentalInspection.matches', 'Matches')}
      </Button>
      <Button mode="outlined" icon="camera" textColor={colors.text.secondary} onPress={() => setOpen(true)}>
        {t('rentalInspection.askPhotos', "Doesn't match · ask for new photos")}
      </Button>
      {props.showDecline ? (
        <Button textColor={colors.error.main} onPress={props.onDecline}>
          {t('pickupDecline.cta', 'Not as described? Decline')}
        </Button>
      ) : null}
      <AskSheet open={open} busy={props.busy} onClose={() => setOpen(false)} onSend={props.onAsk} />
    </View>
  );
}

function ReuseNote({ photos, timeZone }: { photos: InspectionPhoto[]; timeZone: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!photos.some((photo) => photo.reused)) return null;
  return (
    <Text style={{ color: colors.text.secondary }}>
      {t('rentalInspection.reuseDated', 'Some photos are from an earlier rental. Each shows the date it was taken ({{zone}} time).', { zone: listingCity(timeZone) })}
    </Text>
  );
}

function AskSheet({
  open,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (reasons: string[], note: string) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, padding: spacing.lg }]} onPress={() => undefined}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text.primary, textAlign: 'center' }}>
            {t('rentalInspection.askTitle', 'Ask for new photos')}
          </Text>
          <Text style={{ color: colors.text.secondary, textAlign: 'center', marginVertical: 8 }}>
            {t('rentalInspection.askBody', 'The business retakes the photos. You check again before starting. Nothing is charged meanwhile.')}
          </Text>
          <ReasonChips selected={reasons} onToggle={(code) => setReasons((prev) => prev.includes(code) ? prev.filter((row) => row !== code) : [...prev, code])} />
          <TextInput mode="outlined" multiline label={t('rentalInspection.noteOptional', 'Note (optional)')} value={note} onChangeText={setNote} />
          <Button mode="contained" icon="send" buttonColor={colors.primary.main} loading={busy} onPress={() => onSend(reasons, note)}>
            {t('rentalInspection.sendToBusiness', 'Send to business')}
          </Button>
          <Button onPress={onClose}>{t('common.back', 'Back')}</Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ReasonChips({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const labels = reasonLabels(t);
  return (
    <View style={styles.chips}>
      {REASON_ORDER.map((code) => {
        const on = selected.includes(code);
        return (
          <Pressable key={code} onPress={() => onToggle(code)} style={[styles.chip, { borderColor: on ? colors.primary.main : colors.border, backgroundColor: on ? colors.primary.main + '14' : colors.surface }]}>
            <Text style={{ color: on ? colors.primary.main : colors.text.primary }}>{labels[code]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Waiting(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const parts = splitCorrectionReason(props.view.correctionReason, reasonLabels(t));
  const askedAt = props.view.askedAt || props.view.submittedAt;
  const asked = askedAt ? formatZonedTime(askedAt, props.timeZone) : '';
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="clock-outline" size={18} color={colors.warning.main} />
        <Text style={{ color: colors.warning.dark ?? colors.warning.main, marginLeft: 8, flex: 1 }}>
          {t('rentalInspection.waitingPhotos', "Waiting for new photos. We'll notify you when they're ready.")}
        </Text>
      </View>
      <ChipRow chips={parts.chips} />
      {parts.note ? <Text style={{ color: colors.text.primary }}>{parts.note}</Text> : null}
      {asked ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('rentalInspection.youAskedAt', 'You asked at {{time}}', { time: asked })}
        </Text>
      ) : null}
      {props.showDecline ? (
        <Button textColor={colors.error.main} onPress={props.onDecline}>
          {t('pickupDecline.cta', 'Not as described? Decline')}
        </Button>
      ) : null}
    </View>
  );
}

function ChipRow({ chips }: { chips: string[] }) {
  const { colors } = useTheme();
  if (!chips.length) return null;
  return (
    <View style={styles.chips}>
      {chips.map((chip) => (
        <View key={chip} style={[styles.chip, { borderColor: colors.warning.main, backgroundColor: colors.warning.main + '22' }]}>
          <Text style={{ color: colors.text.primary }}>{chip}</Text>
        </View>
      ))}
    </View>
  );
}

function LockedStart() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Button mode="contained" icon="lock" disabled buttonColor={colors.text.disabled}>
      {t('rentals.actions.startRental', 'Start rental')}
    </Button>
  );
}

function StartStep(props: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const phase = pickupPhase({
    now: Date.now(),
    startAt: props.startAt,
    endAt: props.endAt,
    startOpensAt: props.startOpensAt,
    timeZone: props.timeZone,
  });
  const locked = phase === 'before' || phase === 'closed';
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.success.dark ?? colors.success.main }}>
        {t('rentalInspection.checkedAt', 'Item checked. The photos are locked as the pickup condition.')}
      </Text>
      <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{t('rentals.start.confirmTitle', 'Start rental?')}</Text>
      <Text style={{ color: colors.text.secondary }}>
        {t('rentals.start.confirmBody', 'Only start once you are with the business. The business will hand over the item once you start.')}
      </Text>
      <IconLine icon="calendar-clock" label={t('rentals.start.returnBy', 'Return by {{when}}', { when: props.returnLabel })} />
      <IconLine icon="credit-card-outline" label={t('rentals.start.held', '{{amount}} held on your card', { amount: props.money })} />
      <Button mode="contained" icon={locked ? 'lock' : 'play'} disabled={locked} loading={props.starting} buttonColor={colors.primary.main} onPress={props.onStart}>
        {t('rentals.actions.startRental', 'Start rental')}
      </Button>
      <Button textColor={colors.primary.main} onPress={props.onReport}>
        {t('rentalInspection.reportProblem', 'Report a problem')}
      </Button>
    </View>
  );
}

function IconLine({ icon, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.text.secondary} />
      <Text style={{ color: colors.text.primary, marginLeft: 8, flex: 1 }}>{label}</Text>
    </View>
  );
}

function roleLabel(role: string, t: (key: string, fallback: string) => string): string {
  if (role === 'overview') return t('rentalInspection.overview', 'Overview');
  if (role === 'other_side') return t('rentalInspection.otherSide', 'Other side');
  if (role === 'accessories') return t('rentalInspection.accessories', 'Accessories');
  return role;
}

function reasonLabels(t: (key: string, fallback: string) => string): Record<string, string> {
  return {
    photo_mismatch: t('rentalInspection.reasonPhotoMismatch', "Photo doesn't match"),
    wear_hidden: t('rentalInspection.reasonWearHidden', 'Wear not shown'),
    missing_accessory: t('rentalInspection.reasonMissingAccessory', 'Missing accessory'),
    wrong_unit: t('rentalInspection.reasonWrongUnit', 'Wrong unit'),
  };
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  stepDot: { alignItems: 'center', gap: 4, maxWidth: 120 },
  circle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%' },
  frame: { height: 96, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: 96 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
