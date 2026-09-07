import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Switch, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { accurateLifecyclePill } from '../../utils/adminLifecycleUi';
import {
  ADMIN_BUSINESS_ID_FILTERS,
  ADMIN_BUSINESS_LIFECYCLE_FILTERS,
} from '../../utils/adminIdPretexts';

export interface AdminBusinessFiltersProps {
  lifecycleStatus: string;
  idDocumentStatus: string;
  needsAttention: boolean;
  compact?: boolean;
  onLifecycleChange: (value: string) => void;
  onIdDocumentChange: (value: string) => void;
  onNeedsAttentionChange: (value: boolean) => void;
}

function idFilterLabel(
  value: string,
  t: (key: string, defaultValue: string) => string
): string {
  if (!value) return t('admin.businesses.filters.idAll', 'All');
  if (value === 'not_approved') {
    return t('admin.businesses.idStatus.notApproved', 'ID not approved');
  }
  return t(`admin.businesses.idStatus.${value}`, value);
}

export function AdminBusinessFilters({
  lifecycleStatus,
  idDocumentStatus,
  needsAttention,
  compact = false,
  onLifecycleChange,
  onIdDocumentChange,
  onNeedsAttentionChange,
}: AdminBusinessFiltersProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing } = useTheme();

  return (
    <View style={compact ? undefined : { gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {compact
          ? `${t('admin.businesses.filters.lifecycle', 'Lifecycle')}:`
          : t('admin.businesses.filters.lifecycle', 'Lifecycle')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {ADMIN_BUSINESS_LIFECYCLE_FILTERS.map((value) => {
            const selected = lifecycleStatus === value;
            const label = !value
              ? t('admin.businesses.filters.lifecycleAll', 'All')
              : accurateLifecyclePill(value, colors, t).label;
            return (
              <Button
                key={value || 'all'}
                mode={selected ? 'contained' : 'outlined'}
                compact
                onPress={() => onLifecycleChange(value)}
              >
                {label}
              </Button>
            );
          })}
        </View>
      </ScrollView>

      <Text
        style={[
          typography.caption,
          {
            color: colors.text.secondary,
            marginTop: compact ? 6 : 0,
          },
        ]}
      >
        {compact
          ? `${t('admin.businesses.filters.idDocuments', 'ID')}:`
          : t('admin.businesses.filters.idDocuments', 'ID documents')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chipRow}>
          {ADMIN_BUSINESS_ID_FILTERS.map((value) => {
            const selected = idDocumentStatus === value;
            return (
              <Button
                key={value || 'all'}
                mode={selected ? 'contained' : 'outlined'}
                compact
                onPress={() => onIdDocumentChange(value)}
              >
                {idFilterLabel(value, t)}
              </Button>
            );
          })}
        </View>
      </ScrollView>

      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: compact ? 4 : 0 },
        ]}
      >
        {t('admin.businesses.filters.sortNewest', 'Most recent first')}
      </Text>

      <View style={styles.needsAttentionRow}>
        <Text
          style={[
            typography.body2,
            { color: colors.text.primary, flex: 1, minWidth: 0 },
          ]}
        >
          {t('admin.businesses.filters.needsAttention', 'Needs attention')}
        </Text>
        <Switch value={needsAttention} onValueChange={onNeedsAttentionChange} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  needsAttentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
