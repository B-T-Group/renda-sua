import React from 'react';
import { Image, ScrollView, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';

export interface SentPhoto {
  id: string;
  role: string;
  url?: string;
}

const PHOTO_ROLES = ['overview', 'other_side', 'accessories'] as const;

export function ReportSentConfirmation({
  stage,
  renterName,
  unitCount,
  versionNo: _versionNo,
  when,
  photos,
  canEdit,
  onBack,
  onEdit,
}: {
  stage: 'pickup' | 'return';
  renterName: string;
  unitCount: number;
  versionNo: number;
  when: string;
  photos: SentPhoto[];
  canEdit: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = colors.cta?.main ?? '#0B7A3B';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 24 }}
    >
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {t('rentalInspection.confirm.pageTitle', 'Confirmation')}
      </Text>
      <SentHero accent={accent} />
      <Text style={[typography.h5, { color: colors.text.primary, marginTop: spacing.sm }]}>
        {t('rentalInspection.confirm.sentTitle', 'Condition report sent')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>
        {stage === 'return'
          ? t('rentalInspection.confirm.sentLeadReturn', 'We asked {{name}} to review the return. The rental stays open until they accept.', { name: renterName })
          : t('rentalInspection.confirm.sentLead', 'We asked {{name}} to review it. Hand over the item once they accept. The rental starts automatically.', { name: renterName })}
      </Text>
      <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.sm }]}>
        {t('rentalInspection.confirm.unitLine', '{{count}} unit · {{when}}', {
          count: unitCount,
          when,
        })}
      </Text>
      <PhotoStrip photos={photos} />
      <SentSteps stage={stage} accent={accent} />
      <Button mode="contained" buttonColor={accent} style={{ marginTop: spacing.lg, minHeight: 48 }} onPress={onBack}>
        {t('rentalInspection.confirm.backToBooking', 'Back to booking')}
      </Button>
      {canEdit ? (
        <Button mode="text" textColor={accent} icon="pencil" style={{ marginTop: spacing.xs }} onPress={onEdit}>
          {t('rentalInspection.confirm.editReport', 'Edit report')}
        </Button>
      ) : null}
    </ScrollView>
  );
}

function SentHero({ accent }: { accent: string }) {
  return (
    <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: accent + '18', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
      <MaterialCommunityIcons name="check" size={28} color={accent} />
    </View>
  );
}

function PhotoStrip({ photos }: { photos: SentPhoto[] }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
      {PHOTO_ROLES.map((role) => {
        const photo = photos.find((row) => row.role === role);
        const label = t(`rentalInspection.${role === 'other_side' ? 'otherSide' : role}`, role);
        return (
          <View key={role} style={{ flex: 1 }}>
            {photo?.url ? (
              <Image source={{ uri: photo.url }} style={{ height: 72, borderRadius: 8, backgroundColor: colors.divider }} />
            ) : (
              <View style={{ height: 72, borderRadius: 8, backgroundColor: colors.divider }} />
            )}
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SentSteps({ stage, accent }: { stage: 'pickup' | 'return'; accent: string }) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const last = stage === 'return'
    ? t('rentalInspection.confirm.stepCloses', 'Return closes')
    : t('rentalInspection.confirm.stepStarts', 'Rental starts');
  const steps = [
    { label: t('rentalInspection.confirm.stepSent', 'Report sent'), state: 'done' },
    { label: t('rentalInspection.confirm.stepReview', 'Renter reviews'), state: 'current' },
    { label: last, state: 'later' },
  ];
  return (
    <View style={{ marginTop: spacing.lg }}>
      {steps.map((step) => (
        <View key={step.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
          <MaterialCommunityIcons
            name={step.state === 'later' ? 'circle-outline' : step.state === 'current' ? 'circle' : 'check-circle'}
            size={18}
            color={step.state === 'later' ? colors.text.disabled : accent}
          />
          <Text style={[typography.body2, { marginLeft: spacing.sm, color: step.state === 'later' ? colors.text.disabled : colors.text.primary, fontWeight: step.state === 'current' ? '700' : '400' }]}>
            {step.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
