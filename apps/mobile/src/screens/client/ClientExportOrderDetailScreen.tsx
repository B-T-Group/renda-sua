import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useExportOrders } from '../../hooks/useExportOrders';
import { ExportOrderProgress } from '../../components/exportOrders/ExportOrderProgress';
import { ExportOrderNextStepCard } from '../../components/exportOrders/ExportOrderNextStepCard';
import {
  ExportOrderDocumentsCard,
  ExportOrderHero,
  ExportOrderItemsCard,
} from '../../components/exportOrders/ExportOrderSummaryCards';
import type { ExportOrderDetail } from '../../services/exportOrdersApi';
import type { ClientRootStackParamList } from '../../navigation/types';

type Params = { ClientExportOrderDetail: ClientRootStackParamList['ClientExportOrderDetail'] };

interface ActionsProps {
  order: ExportOrderDetail;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => void;
}

function OrderActions({ order, busy, run }: ActionsProps) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { proformaAction, selectBalanceOption, confirmDelivery } = useExportOrders();
  const [notes, setNotes] = useState('');

  if (order.status === 'PROFORMA_ISSUED') {
    return (
      <View style={{ gap: spacing.sm }}>
        <TextInput
          mode="outlined"
          multiline
          label={t('exportOrders.notes', 'Notes')}
          value={notes}
          onChangeText={setNotes}
        />
        <Button testID="export-approve" mode="contained" disabled={busy} onPress={() => run(() => proformaAction(order.id, 'approve'))}>
          {t('exportOrders.approveProforma', 'Approve proforma')}
        </Button>
        <Button testID="export-adjust" mode="outlined" disabled={busy} onPress={() => run(() => proformaAction(order.id, 'request_adjustment', notes))}>
          {t('exportOrders.requestAdjustment', 'Request adjustment')}
        </Button>
      </View>
    );
  }
  if (order.status === 'BALANCE_REQUIRED') {
    return (
      <View style={{ gap: spacing.sm }}>
        <Button mode="contained" disabled={busy} onPress={() => run(() => selectBalanceOption(order.id, 'FULL'))}>
          {t('exportOrders.payFull', 'Pay in full')}
        </Button>
        <Button mode="outlined" disabled={busy} onPress={() => run(() => selectBalanceOption(order.id, 'FINANCED_30'))}>
          {t('exportOrders.finance30', 'Finance 30 days')}
        </Button>
        <Button mode="outlined" disabled={busy} onPress={() => run(() => selectBalanceOption(order.id, 'FINANCED_60'))}>
          {t('exportOrders.finance60', 'Finance 60 days')}
        </Button>
      </View>
    );
  }
  if (order.status === 'SHIPPED') {
    return (
      <Button testID="export-confirm-delivery" mode="contained" disabled={busy} onPress={() => run(() => confirmDelivery(order.id))}>
        {t('exportOrders.confirmDelivery', 'Confirm delivery')}
      </Button>
    );
  }
  return null;
}

export default function ClientExportOrderDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { orderId } = useRoute<RouteProp<Params, 'ClientExportOrderDetail'>>().params;
  const { getOne } = useExportOrders();
  const [order, setOrder] = useState<ExportOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await getOne(orderId));
      setError(null);
    } catch {
      setError(t('exportOrders.loadError', 'Could not load your export orders'));
    } finally {
      setLoading(false);
    }
  }, [getOne, orderId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch {
      setError(t('exportOrders.actionError', 'That action did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary.main} />;
  }
  if (!order) {
    return <Text style={{ padding: spacing.md, color: colors.text.secondary }}>{error}</Text>;
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
    >
      <ExportOrderHero order={order} />
      {error ? <Text style={{ color: colors.error.main }}>{error}</Text> : null}
      <ExportOrderNextStepCard status={order.status}>
        <OrderActions order={order} busy={busy} run={run} />
      </ExportOrderNextStepCard>
      <ExportOrderItemsCard lines={order.lines ?? []} />
      <ExportOrderProgress status={order.status} />
      <ExportOrderDocumentsCard documents={order.documents ?? []} />
    </ScrollView>
  );
}
