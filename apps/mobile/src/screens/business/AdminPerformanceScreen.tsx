import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Menu, SegmentedButtons, Switch, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { adminPerformanceApi } from '../../services/adminPerformanceApi';
import { useProfileMe } from '../../hooks/useProfileMe';
import { usePermission } from '../../hooks/usePermissions';
import { useTheme } from '../../contexts/ThemeContext';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { StatusPill } from '../../components/common/StatusPill';
import {
  GOLDEN_ITEMS_PER_REFERRAL,
  type PerformanceMarket,
  type PerformancePeriodEdge,
  type PerformancePeriodUnit,
  type PerformanceSummary,
  type TopAgentEntry,
} from '../../types/adminPerformance';
import { resolvePerformanceWindow } from '../../utils/adminPerformancePeriods';
import { filterAgentsPendingReview } from '../../utils/adminPerformanceReviewFilter';
import { formatCurrency } from '../../utils/formatters';

interface MetricCardProps {
  label: string;
  value: number | null;
}

function MetricCard({ label, value }: MetricCardProps) {
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  return (
    <View
      style={[
        styles.metricCard,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[typography.caption, { color: colors.text.secondary }]}>
        {label}
      </Text>
      <Text
        style={[typography.display, { color: colors.text.primary, marginTop: 4 }]}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

function agentName(agent: TopAgentEntry): string {
  return `${agent.firstName} ${agent.lastName}`.trim() || agent.agentId;
}

interface DeliveriesBoardProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
}

function DeliveriesBoard({ agents, emptyLabel }: DeliveriesBoardProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  return (
    <View
      style={[
        styles.leaderboard,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[typography.subheading, { color: colors.text.primary }]}>
        {t(
          'admin.performance.topAgents.deliveriesTitle',
          'Top agents by deliveries'
        )}
      </Text>
      {agents.length === 0 ? (
        <Text
          style={[
            typography.body2,
            { color: colors.text.secondary, marginTop: spacing.sm },
          ]}
        >
          {emptyLabel}
        </Text>
      ) : (
        agents.map((agent, index) => (
          <View
            key={agent.agentId}
            style={[styles.leaderboardRow, { marginTop: spacing.sm }]}
          >
            <Text style={[typography.body2, { color: colors.text.secondary }]}>
              {index + 1}.
            </Text>
            <View style={styles.leaderboardName}>
              <Text
                style={[typography.body, { color: colors.text.primary }]}
                numberOfLines={1}
              >
                {agentName(agent)}
              </Text>
              {agent.agentCode ? (
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {agent.agentCode}
                </Text>
              ) : null}
            </View>
            <Text style={[typography.subheading, { color: colors.text.primary }]}>
              {agent.count}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

interface ReferralsBoardProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
  goldenOnly: boolean;
  hideApproved: boolean;
}

function ReferralsBoard({
  agents,
  emptyLabel,
  goldenOnly,
  hideApproved,
}: ReferralsBoardProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const visibleAgents = hideApproved
    ? filterAgentsPendingReview(agents)
    : agents;

  const toggleAgent = (agentId: string) =>
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));

  return (
    <View
      style={[
        styles.leaderboard,
        shadows.sm,
        {
          borderColor: colors.divider,
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
      ]}
    >
      <Text style={[typography.subheading, { color: colors.text.primary }]}>
        {t(
          'admin.performance.topAgents.referralsTitle',
          'Top agents by business referrals'
        )}
      </Text>
      <View
        style={{
          marginTop: spacing.xs,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
        }}
      >
        {goldenOnly ? (
          <StatusPill
            compact
            label={t(
              'admin.performance.topAgents.goldenFilterActive',
              '≥{{n}} items / referral',
              { n: GOLDEN_ITEMS_PER_REFERRAL }
            )}
            backgroundColor={colors.success.main + '22'}
            textColor={colors.success.dark ?? colors.success.main}
          />
        ) : null}
        {hideApproved ? (
          <StatusPill
            compact
            label={t(
              'admin.performance.reviewFilter.hideApprovedActive',
              'Pending review only'
            )}
            backgroundColor={colors.warning.main + '22'}
            textColor={colors.warning.dark ?? colors.warning.main}
          />
        ) : null}
      </View>
      <Text
        style={[
          typography.caption,
          { color: colors.text.secondary, marginTop: spacing.xs },
        ]}
      >
        {t(
          'admin.performance.topAgents.referralsHelp',
          'Items / referral = sale items on referred businesses ÷ referrals. Target: ≥{{n}}.',
          { n: GOLDEN_ITEMS_PER_REFERRAL }
        )}
      </Text>
      {visibleAgents.length === 0 ? (
        <Text
          style={[
            typography.body2,
            { color: colors.text.secondary, marginTop: spacing.sm },
          ]}
        >
          {emptyLabel}
        </Text>
      ) : (
        visibleAgents.map((agent, index) => {
          const isExpanded = expandedAgentId === agent.agentId;
          const businesses = agent.referredBusinesses ?? [];
          return (
            <View
              key={agent.agentId}
              style={[
                styles.referralRow,
                {
                  marginTop: spacing.sm,
                  borderTopColor: colors.divider,
                  paddingTop: spacing.sm,
                },
              ]}
            >
              {/* Agent header row — tapping toggles expansion */}
              <Pressable
                onPress={() => toggleAgent(agent.agentId)}
                style={styles.referralHeader}
              >
                <Text style={[typography.body2, { color: colors.text.secondary }]}>
                  {index + 1}.
                </Text>
                <View style={styles.leaderboardName}>
                  <Text
                    style={[typography.body, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {agentName(agent)}
                  </Text>
                  {agent.agentCode ? (
                    <Text style={[typography.caption, { color: colors.text.secondary }]}>
                      {agent.agentCode}
                    </Text>
                  ) : null}
                  {agent.isInternal ? (
                    <StatusPill
                      compact
                      label={t(
                        'admin.performance.topAgents.internalEmployee',
                        'Internal'
                      )}
                      backgroundColor={colors.primary.main + '18'}
                      textColor={colors.primary.main}
                    />
                  ) : null}
                  {agent.earnedAmount != null &&
                  agent.earnedAmount > 0 &&
                  agent.earnedCurrency ? (
                    <StatusPill
                      compact
                      label={t(
                        'admin.performance.topAgents.earned',
                        '{{amount}} earned',
                        {
                          amount: formatCurrency(
                            agent.earnedAmount,
                            agent.earnedCurrency,
                            i18n.language
                          ),
                        }
                      )}
                      backgroundColor={colors.success.main + '22'}
                      textColor={colors.success.dark ?? colors.success.main}
                    />
                  ) : null}
                  {agent.projectedPayoutAmount != null &&
                  agent.projectedPayoutAmount > 0 ? (
                    <StatusPill
                      compact
                      label={t(
                        'admin.performance.topAgents.upcomingPayout',
                        'Upcoming {{amount}}',
                        {
                          amount: formatCurrency(
                            agent.projectedPayoutAmount,
                            agent.projectedPayoutCurrency ?? 'XAF',
                            i18n.language
                          ),
                        }
                      )}
                      backgroundColor={colors.warning.main + '22'}
                      textColor={colors.warning.dark}
                    />
                  ) : null}
                </View>
                <StatusPill
                  compact
                  label={String(agent.itemsPerReferral ?? 0)}
                  backgroundColor={
                    agent.meetsGoldenRatio
                      ? colors.success.main + '22'
                      : colors.pageBackground
                  }
                  textColor={
                    agent.meetsGoldenRatio
                      ? colors.success.dark ?? colors.success.main
                      : colors.text.primary
                  }
                />
                {businesses.length > 0 ? (
                  <IconButton
                    icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    iconColor={colors.text.secondary}
                    style={{ margin: 0, marginRight: -4 }}
                  />
                ) : null}
              </Pressable>

              <Text
                style={[
                  typography.caption,
                  { color: colors.text.secondary, marginTop: 4 },
                ]}
              >
                {t(
                  'admin.performance.topAgents.referralStats',
                  '{{referrals}} referrals · {{items}} items · {{stocked}}/{{referrals}} stocked',
                  {
                    referrals: agent.count,
                    items: agent.inventoryItemsCount ?? 0,
                    stocked: agent.stockedReferralCount ?? 0,
                  }
                )}
              </Text>

              {/* Referred businesses list — shown when expanded */}
              {isExpanded && businesses.length > 0 ? (
                <View
                  style={[
                    styles.businessList,
                    {
                      marginTop: spacing.sm,
                      backgroundColor: colors.pageBackground,
                      borderRadius: borderRadius.sm,
                      borderColor: colors.divider,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.caption,
                      {
                        color: colors.text.secondary,
                        paddingHorizontal: spacing.sm,
                        paddingTop: spacing.xs,
                        paddingBottom: 4,
                      },
                    ]}
                  >
                    {t(
                      'admin.performance.topAgents.referredBusinesses',
                      'Referred businesses'
                    )}
                  </Text>
                  {businesses.map((biz, bizIdx) => {
                    const reviewLabel = biz.isPaid
                      ? t('admin.referralReview.status.paid', 'Paid')
                      : biz.payoutReviewStatus === 'approved'
                        ? t('admin.referralReview.status.approved', 'Approved')
                        : biz.payoutReviewStatus === 'rejected'
                          ? t('admin.referralReview.status.rejected', 'Rejected')
                          : t(
                              'admin.referralReview.status.pending',
                              'Pending review'
                            );
                    return (
                    <Pressable
                      key={biz.businessId}
                      onPress={() =>
                        navigation.navigate('BusinessReferralReview', {
                          businessId: biz.businessId,
                        })
                      }
                      style={[
                        styles.businessRow,
                        {
                          borderTopWidth: bizIdx === 0 ? 0 : StyleSheet.hairlineWidth,
                          borderTopColor: colors.divider,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xs,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[typography.body2, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {biz.businessName}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            { color: colors.text.secondary },
                          ]}
                        >
                          {t(
                            'admin.performance.topAgents.businessItems',
                            '{{count}} items',
                            { count: biz.itemCount }
                          )}
                        </Text>
                        {biz.earnedAmount && agent.earnedCurrency ? (
                          <Text
                            style={[
                              typography.caption,
                              { color: colors.text.secondary },
                            ]}
                          >
                            {formatCurrency(
                              biz.earnedAmount,
                              agent.earnedCurrency,
                              i18n.language
                            )}
                          </Text>
                        ) : null}
                      </View>
                      <StatusPill compact label={reviewLabel} />
                      <IconButton
                        icon="clipboard-check-outline"
                        size={18}
                        iconColor={colors.primary.main}
                        style={{ margin: 0 }}
                      />
                    </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

export default function AdminPerformanceScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(
    PlatformPermissions.DASHBOARD_PLATFORM_STATS,
    me
  );

  const [unit, setUnit] = useState<PerformancePeriodUnit>('week');
  const [edge, setEdge] = useState<PerformancePeriodEdge>('current');
  const [countryCode, setCountryCode] = useState('');
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [hideApproved, setHideApproved] = useState(false);
  const [markets, setMarkets] = useState<PerformanceMarket[]>([]);
  const [marketMenuVisible, setMarketMenuVisible] = useState(false);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [topDeliveries, setTopDeliveries] = useState<TopAgentEntry[]>([]);
  const [topReferrals, setTopReferrals] = useState<TopAgentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSeqRef = useRef(0);

  useEffect(() => {
    if (!canAccess) return;
    adminPerformanceApi
      .fetchPerformanceMarkets()
      .then(setMarkets)
      .catch(() => setMarkets([]));
  }, [canAccess]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!canAccess) return;
      const seq = ++loadSeqRef.current;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const window = resolvePerformanceWindow(unit, edge);
        const country = countryCode || undefined;
        const referralOpts = {
          limit: 20,
          minItemsPerReferral: goldenOnly
            ? GOLDEN_ITEMS_PER_REFERRAL
            : undefined,
        };
        const [summaryData, deliveries, referrals] = await Promise.all([
          adminPerformanceApi.fetchPerformanceSummary(window, country),
          adminPerformanceApi.fetchPerformanceTopAgents(
            window,
            'deliveries',
            country
          ),
          adminPerformanceApi.fetchPerformanceTopAgents(
            window,
            'business_referrals',
            country,
            referralOpts
          ),
        ]);
        if (seq !== loadSeqRef.current) return;
        setSummary(summaryData);
        setTopDeliveries(deliveries);
        setTopReferrals(referrals);
      } catch (e: unknown) {
        if (seq !== loadSeqRef.current) return;
        setError(
          e instanceof Error
            ? e.message
            : t('admin.performance.loadError', 'Could not load performance data')
        );
      } finally {
        if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [canAccess, unit, edge, countryCode, goldenOnly, t]
  );

  useEffect(() => {
    if (!profileLoading && canAccess) void load();
  }, [canAccess, load, profileLoading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ silent: true });
  }, [load]);

  const selectedMarket = markets.find((m) => m.countryCode === countryCode);
  const marketLabel = selectedMarket
    ? `${selectedMarket.countryName} (${selectedMarket.countryCode})`
    : t('admin.performance.allMarkets', 'All markets');

  if (profileLoading) {
    return (
      <View
        style={[styles.centered, { backgroundColor: colors.pageBackground }]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.pageBackground, padding: spacing.lg },
        ]}
      >
        <Text
          variant="titleMedium"
          style={{ color: colors.text.primary, textAlign: 'center' }}
        >
          {t('admin.performance.accessDenied', 'Access denied')}
        </Text>
      </View>
    );
  }

  const metricCards: Array<[string, string, number | null]> = [
    [
      'admin.performance.metrics.businessesEnrolled',
      'Businesses enrolled',
      summary?.businessesEnrolled ?? null,
    ],
    [
      'admin.performance.metrics.clientsAdded',
      'Clients added',
      summary?.clientsAdded ?? null,
    ],
    [
      'admin.performance.metrics.agentsAdded',
      'Agents added',
      summary?.agentsAdded ?? null,
    ],
    [
      'admin.performance.metrics.saleItemsAdded',
      'Sale items added',
      summary?.saleItemsAdded ?? null,
    ],
    [
      'admin.performance.metrics.rentalItemsAdded',
      'Rental items added',
      summary?.rentalItemsAdded ?? null,
    ],
  ];

  const emptyLabel = t(
    'admin.performance.topAgents.empty',
    'No data for this period'
  );
  const goldenEmpty = t(
    'admin.performance.topAgents.goldenEmpty',
    'No agents meet the ≥{{n}} items / referral target for this period',
    { n: GOLDEN_ITEMS_PER_REFERRAL }
  );
  const hideApprovedEmpty = t(
    'admin.performance.reviewFilter.hideApprovedEmpty',
    'No referrals still need review for this period'
  );
  const referralsEmpty = hideApproved
    ? hideApprovedEmpty
    : goldenOnly
      ? goldenEmpty
      : emptyLabel;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={[typography.body2, { color: colors.text.secondary }]}>
        {t(
          'admin.performance.subtitle',
          'Enrollment and catalog growth by market and period.'
        )}
      </Text>

      <Menu
        visible={marketMenuVisible}
        onDismiss={() => setMarketMenuVisible(false)}
        anchor={
          <Button
            mode="outlined"
            icon="earth"
            onPress={() => setMarketMenuVisible(true)}
          >
            {marketLabel}
          </Button>
        }
      >
        <Menu.Item
          onPress={() => {
            setCountryCode('');
            setMarketMenuVisible(false);
          }}
          title={t('admin.performance.allMarkets', 'All markets')}
        />
        {markets.map((market) => (
          <Menu.Item
            key={market.countryCode}
            onPress={() => {
              setCountryCode(market.countryCode);
              setMarketMenuVisible(false);
            }}
            title={`${market.countryName} (${market.countryCode})`}
          />
        ))}
      </Menu>

      <SegmentedButtons
        value={unit}
        onValueChange={(value) => setUnit(value as PerformancePeriodUnit)}
        buttons={[
          { value: 'week', label: t('admin.performance.units.week', 'Week') },
          { value: 'month', label: t('admin.performance.units.month', 'Month') },
          { value: 'year', label: t('admin.performance.units.year', 'Year') },
        ]}
      />
      <SegmentedButtons
        value={edge}
        onValueChange={(value) => setEdge(value as PerformancePeriodEdge)}
        buttons={[
          {
            value: 'current',
            label: t('admin.performance.edges.current', 'Current'),
          },
          { value: 'last', label: t('admin.performance.edges.last', 'Last') },
        ]}
      />

      <View
        style={[
          styles.goldenCard,
          {
            borderColor: colors.success.main + '55',
            backgroundColor: colors.success.main + '12',
            borderRadius: borderRadius.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={[typography.subheading, { color: colors.text.primary }]}>
          {t('admin.performance.golden.title', 'Referral quality target')}
        </Text>
        <Text
          style={[
            typography.caption,
            { color: colors.text.secondary, marginTop: 4 },
          ]}
        >
          {t(
            'admin.performance.golden.description',
            'Goal: each referred business should reach at least {{n}} sale catalog items on average (items / referral).',
            { n: GOLDEN_ITEMS_PER_REFERRAL }
          )}
        </Text>
        <View style={styles.goldenSwitchRow}>
          <Text
            style={[
              typography.body2,
              { color: colors.text.primary, flex: 1, minWidth: 0 },
            ]}
          >
            {t(
              'admin.performance.golden.filterLabel',
              'Only agents ≥{{n}} items / referral',
              { n: GOLDEN_ITEMS_PER_REFERRAL }
            )}
          </Text>
          <Switch
            value={goldenOnly}
            onValueChange={setGoldenOnly}
            color={colors.success.main}
          />
        </View>
        <View style={styles.goldenSwitchRow}>
          <Text
            style={[
              typography.body2,
              { color: colors.text.primary, flex: 1, minWidth: 0 },
            ]}
          >
            {t(
              'admin.performance.reviewFilter.hideApprovedLabel',
              'Hide already approved'
            )}
          </Text>
          <Switch
            value={hideApproved}
            onValueChange={setHideApproved}
            color={colors.warning.main}
          />
        </View>
      </View>

      {error ? (
        <Text style={[typography.body2, { color: colors.error.main }]}>
          {error}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator /> : null}

      <View style={styles.metricGrid}>
        {metricCards.map(([key, fallback, value]) => (
          <MetricCard key={key} label={t(key, fallback)} value={value} />
        ))}
      </View>

      <ReferralsBoard
        agents={topReferrals}
        emptyLabel={referralsEmpty}
        goldenOnly={goldenOnly}
        hideApproved={hideApproved}
      />
      <DeliveriesBoard agents={topDeliveries} emptyLabel={emptyLabel} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
  },
  leaderboard: {
    borderWidth: 1,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leaderboardName: {
    flex: 1,
    minWidth: 0,
  },
  goldenCard: {
    borderWidth: 1,
  },
  goldenSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  referralRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessList: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
