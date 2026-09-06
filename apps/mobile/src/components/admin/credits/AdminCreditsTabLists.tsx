import React from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, Text } from 'react-native';
import {
  CreditsEscalationCard,
  CreditsFeedbackCard,
  CreditsProgressCard,
} from '@/components/admin/credits/AdminCreditsCards';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  AdminCreditsTab,
  CreditsEscalationRow,
  CreditsFeedbackOrderRow,
  CreditsSummaryRow,
} from '@/types/adminCredits';

interface AdminCreditsTabListsProps {
  tab: AdminCreditsTab;
  refreshing: boolean;
  submitting: boolean;
  escalations: CreditsEscalationRow[];
  cancelled: CreditsFeedbackOrderRow[];
  firstOrders: CreditsFeedbackOrderRow[];
  summary: CreditsSummaryRow[];
  onRefresh: () => void;
  onResolve: (incidentId: string) => void;
  onOpenOrder: (orderId: string) => void;
  onRecordFeedback: (
    orderId: string,
    mode: 'cancelled' | 'first_order'
  ) => void;
}

export function AdminCreditsTabLists({
  tab,
  refreshing,
  submitting,
  escalations,
  cancelled,
  firstOrders,
  summary,
  onRefresh,
  onResolve,
  onOpenOrder,
  onRecordFeedback,
}: AdminCreditsTabListsProps) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  );
  const empty = (message: string) => (
    <Text
      style={[
        typography.body2,
        {
          color: colors.text.secondary,
          textAlign: 'center',
          marginTop: spacing.xl,
        },
      ]}
    >
      {message}
    </Text>
  );
  const contentStyle = { paddingHorizontal: spacing.md, flexGrow: 1 };

  if (tab === 'escalations') {
    return (
      <FlatList
        data={escalations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentStyle}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <CreditsEscalationCard
            item={item}
            submitting={submitting}
            onResolve={() => onResolve(item.id)}
            onOpenOrder={() => onOpenOrder(item.order_id)}
          />
        )}
        ListEmptyComponent={empty(
          t('admin.credits.emptyEscalations', 'No open escalations')
        )}
      />
    );
  }

  if (tab === 'cancelled') {
    return (
      <FlatList
        data={cancelled}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentStyle}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <CreditsFeedbackCard
            item={item}
            mode="cancelled"
            submitting={submitting}
            onRecord={() => onRecordFeedback(item.id, 'cancelled')}
            onOpenOrder={() => onOpenOrder(item.id)}
          />
        )}
        ListEmptyComponent={empty(
          t('admin.credits.emptyCancelled', 'No cancelled orders waiting')
        )}
      />
    );
  }

  if (tab === 'first_order') {
    return (
      <FlatList
        data={firstOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={contentStyle}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <CreditsFeedbackCard
            item={item}
            mode="first_order"
            submitting={submitting}
            onRecord={() => onRecordFeedback(item.id, 'first_order')}
            onOpenOrder={() => onOpenOrder(item.id)}
          />
        )}
        ListEmptyComponent={empty(
          t(
            'admin.credits.emptyFirstOrder',
            'No first-order call-backs waiting'
          )
        )}
      />
    );
  }

  return (
    <FlatList
      data={summary}
      keyExtractor={(item) => item.user_id}
      contentContainerStyle={contentStyle}
      refreshControl={refreshControl}
      renderItem={({ item }) => <CreditsProgressCard item={item} />}
      ListEmptyComponent={empty(
        t('admin.credits.emptyProgress', 'No credits awarded yet')
      )}
    />
  );
}
