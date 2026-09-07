import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Text } from 'react-native-paper';
import { StatusPill } from '../common/StatusPill';
import { useTheme } from '../../contexts/ThemeContext';
import type { BackendUserDocument } from '../../hooks/useBackendDocuments';
import { formatFileSize } from '../../utils/formatters';

interface UserDocumentCardProps {
  doc: BackendUserDocument;
  /** True while the presigned view URL for this document is being fetched. */
  opening?: boolean;
  onPress: (doc: BackendUserDocument) => void;
}

/** System-generated types with no review workflow; status is never shown. */
const AUTO_APPROVED_TYPE_NAMES = [
  'order_receipt',
  'rendasua_contract_agreement',
  'rendasua_training_completion',
];

function iconForContentType(
  contentType?: string
): keyof typeof MaterialCommunityIcons.glyphMap {
  if (contentType?.startsWith('image/')) return 'image-outline';
  if (contentType === 'application/pdf') return 'file-pdf-box';
  return 'file-document-outline';
}

export function UserDocumentCard({ doc, opening, onPress }: UserDocumentCardProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, borderRadius, shadows } = useTheme();

  const isAutoApproved = AUTO_APPROVED_TYPE_NAMES.includes(
    doc.document_type?.name ?? ''
  );
  // System docs (receipts, agreements) store a descriptive note — not a
  // rejection reason — and never go through review.
  const isRejected = !doc.is_approved && !!doc.note && !isAutoApproved;
  const statusLabel = doc.is_approved
    ? t('documents.approved', 'Approved')
    : isRejected
      ? t('documents.rejected', 'Rejected')
      : t('documents.pending', 'Pending review');
  const statusBg = doc.is_approved
    ? colors.success.main + '18'
    : isRejected
      ? colors.error.main + '18'
      : colors.warning.main + '18';
  const statusFg = doc.is_approved
    ? colors.success.dark
    : isRejected
      ? colors.error.dark
      : colors.warning.dark;
  const statusIcon = doc.is_approved
    ? 'check-circle-outline'
    : isRejected
      ? 'close-circle-outline'
      : 'clock-outline';

  const metaParts: string[] = [];
  if (doc.file_size > 0) metaParts.push(formatFileSize(doc.file_size));
  if (doc.created_at) {
    metaParts.push(
      new Date(doc.created_at).toLocaleDateString(i18n.language, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('documents.openDocument', 'Open {{name}}', {
        name: doc.file_name,
      })}
      onPress={() => onPress(doc)}
      disabled={opening}
      android_ripple={{ color: colors.primary.hover }}
      style={({ pressed }) => [
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryTint }]}>
        <MaterialCommunityIcons
          name={iconForContentType(doc.content_type)}
          size={24}
          color={colors.primary.main}
        />
      </View>
      <View style={styles.info}>
        <Text
          style={[{ color: colors.text.primary }, typography.body2, styles.name]}
          numberOfLines={2}
        >
          {doc.file_name}
        </Text>
        <Text style={{ color: colors.text.secondary }} variant="bodySmall" numberOfLines={1}>
          {isAutoApproved && doc.note
            ? doc.note
            : doc.document_type?.description ?? doc.document_type?.name}
        </Text>
        {metaParts.length > 0 ? (
          <Text
            style={[styles.meta, { color: colors.text.secondary }]}
            variant="bodySmall"
            numberOfLines={1}
          >
            {metaParts.join(' · ')}
          </Text>
        ) : null}
        {!isAutoApproved ? (
          <StatusPill
            compact
            label={statusLabel}
            backgroundColor={statusBg}
            textColor={statusFg}
            icon={statusIcon}
            style={styles.pill}
          />
        ) : null}
        {isRejected ? (
          <Text style={[styles.note, { color: colors.error.main }]} variant="bodySmall">
            {doc.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {opening ? (
          <ActivityIndicator size={18} color={colors.primary.main} />
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text.disabled} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontWeight: '600' },
  meta: { marginTop: 2 },
  pill: { marginTop: 6 },
  note: { marginTop: 6 },
  trailing: {
    marginLeft: 8,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
