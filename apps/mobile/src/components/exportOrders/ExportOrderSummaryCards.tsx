import React from 'react';
import { View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { exportOrderDocLabel } from '../../utils/exportOrders/exportOrderProgress';
import { ExportOrderStatusBadge } from './ExportOrderStatusBadge';
import { ExportOrderIllustration } from '../illustrations/ExportOrderIllustration';
import type {
  ExportOrderDetail,
  ExportOrderDocument,
  ExportOrderLine,
} from '../../services/exportOrdersApi';

function useCardStyle() {
  const { colors, spacing, borderRadius } = useTheme();
  return {
    padding: spacing.md,
    borderRadius: borderRadius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: spacing.sm,
  } as const;
}

export function ExportOrderHero({ order }: { order: ExportOrderDetail }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const card = useCardStyle();
  return (
    <View style={[card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
      <ExportOrderIllustration size={72} label={t('exportOrders.submitted.illustration', 'Purchase order received')} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text variant="labelSmall" style={{ color: colors.text.secondary }}>
          {t('exportOrders.purchaseOrder', 'Purchase order')}
        </Text>
        <Text variant="headlineSmall">{order.bc_number}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
          <ExportOrderStatusBadge status={order.status} />
          {order.created_at ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {new Date(order.created_at).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function LineRow({ line }: { line: ExportOrderLine }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <MaterialCommunityIcons name="package-variant-closed" size={22} color={colors.primary.main} />
      <Text style={{ flex: 1 }}>{`${line.quantity} × ${line.product_name}`}</Text>
    </View>
  );
}

export function ExportOrderItemsCard({ lines }: { lines: ExportOrderLine[] }) {
  const { t } = useTranslation();
  const card = useCardStyle();
  if (lines.length === 0) return null;
  return (
    <View style={card}>
      <Text variant="titleSmall">{t('exportOrders.lines', 'Items')}</Text>
      {lines.map((line) => (
        <LineRow key={line.id} line={line} />
      ))}
    </View>
  );
}

function DocumentRow({ doc }: { doc: ExportOrderDocument }) {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <MaterialCommunityIcons name="file-document-outline" size={22} color={colors.primary.main} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">
          {t(`exportOrders.docTypes.${doc.doc_type}`, exportOrderDocLabel(doc.doc_type))}
        </Text>
        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
          {doc.document_number}
        </Text>
      </View>
    </View>
  );
}

export function ExportOrderDocumentsCard({ documents }: { documents: ExportOrderDocument[] }) {
  const { t } = useTranslation();
  const card = useCardStyle();
  if (documents.length === 0) return null;
  return (
    <View style={card}>
      <Text variant="titleSmall">{t('exportOrders.documents', 'Documents')}</Text>
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </View>
  );
}
