import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppModal } from '../../components/common/AppModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { agentApi, type SupportTicket } from '../../services/agentApi';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string, t: (k: string) => string): string {
  const key = `support.status.${status}`;
  const map: Record<string, string> = {
    open: t('support.status.open'),
    in_review: t('support.status.inReview'),
    resolved: t('support.status.resolved'),
  };
  return map[status] ?? status;
}

export default function SupportTicketsScreen() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await agentApi.support.getTickets();
      setTickets(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message ?? t('common.error'));
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  if (loading && tickets.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }, typography.body2]}>
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.pageBackground }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchTickets} colors={[colors.primary.main]} />
        }
      >
        {error ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.error.main} />
            <Text style={[styles.errorText, { color: colors.error.main }, typography.body2]}>{error}</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.divider }]}>
            <MaterialCommunityIcons name="ticket-outline" size={48} color={colors.text.disabled} />
            <Text style={[styles.emptyText, { color: colors.text.secondary }, typography.body2]}>
              {t('support.noTickets', 'Aucun ticket de support')}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.text.disabled }, typography.caption]}>
              {t('support.noTicketsHint', 'Vous pouvez en créer depuis le détail d\'une commande.')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {tickets.map((ticket) => (
              <Pressable
                key={ticket.id}
                onPress={() => setSelectedTicket(ticket)}
                style={({ pressed }) => [
                  styles.ticketRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.divider,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <View style={[styles.ticketIconWrap, { backgroundColor: colors.primaryTint }]}>
                  <MaterialCommunityIcons name="ticket-outline" size={22} color={colors.primary.main} />
                </View>
                <View style={styles.ticketBody}>
                  <Text style={[styles.ticketSubject, { color: colors.text.primary }, typography.subtitle2]} numberOfLines={2}>
                    {ticket.subject}
                  </Text>
                  <Text style={[styles.ticketMeta, { color: colors.text.secondary }, typography.caption]}>
                    {ticket.order?.order_number ? `#${ticket.order.order_number} · ` : ''}
                    {statusLabel(ticket.status, t)} · {formatDate(ticket.created_at)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text.disabled} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <AppModal visible={!!selectedTicket} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedTicket(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: borderRadius.lg }]} onPress={(e) => e.stopPropagation()}>
            {selectedTicket ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text.primary }, typography.subtitle1]} numberOfLines={2}>
                    {selectedTicket.subject}
                  </Text>
                  <Pressable onPress={() => setSelectedTicket(null)} hitSlop={12}>
                    <MaterialCommunityIcons name="close" size={24} color={colors.text.secondary} />
                  </Pressable>
                </View>
                <Text style={[styles.modalMeta, { color: colors.text.secondary }, typography.caption]}>
                  {selectedTicket.order?.order_number ? `Commande #${selectedTicket.order.order_number} · ` : ''}
                  {statusLabel(selectedTicket.status, t)} · {formatDate(selectedTicket.created_at)}
                </Text>
                {selectedTicket.description ? (
                  <Text style={[styles.modalDescription, { color: colors.text.primary }, typography.body2]}>
                    {selectedTicket.description}
                  </Text>
                ) : null}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12 },
  card: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  errorText: { marginTop: 12, textAlign: 'center' },
  emptyText: { marginTop: 12, textAlign: 'center' },
  emptyHint: { marginTop: 8, textAlign: 'center' },
  list: { gap: 10 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  ticketIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  ticketBody: { flex: 1, minWidth: 0 },
  ticketSubject: {},
  ticketMeta: { marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { flex: 1, marginRight: 12 },
  modalMeta: { marginBottom: 12 },
  modalDescription: {},
});
