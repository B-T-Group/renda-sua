import { CheckCircle, ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GOLDEN_ITEMS_PER_REFERRAL,
  type TopAgentEntry,
} from '../../../hooks/useAdminPerformance';
import { formatPayoutMoney } from '../AdminPayoutPreviewTable';

interface TopAgentsReferralsTableProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
  goldenOnly: boolean;
}

function agentDisplayName(agent: TopAgentEntry): string {
  return `${agent.firstName} ${agent.lastName}`.trim() || agent.agentId;
}

function AgentEarnedCell({ agent }: { agent: TopAgentEntry }) {
  const currency = agent.earnedCurrency ?? agent.projectedPayoutCurrency;
  if (agent.earnedAmount == null || !currency) {
    return (
      <Typography variant="body2" color="text.disabled">
        {'—'}
      </Typography>
    );
  }
  return (
    <>
      <Typography variant="body2" fontWeight={700}>
        {formatPayoutMoney(agent.earnedAmount, currency)}
      </Typography>
      <UpcomingPayout agent={agent} />
    </>
  );
}

function UpcomingPayout({ agent }: { agent: TopAgentEntry }) {
  const { t } = useTranslation();
  if (
    agent.projectedPayoutAmount == null ||
    agent.projectedPayoutAmount <= 0 ||
    !agent.projectedPayoutCurrency
  ) {
    return null;
  }
  const amount = formatPayoutMoney(
    agent.projectedPayoutAmount,
    agent.projectedPayoutCurrency
  );
  return (
    <Typography variant="caption" color="text.secondary">
      {t('admin.performance.topAgents.upcomingPayout', 'Upcoming {{amount}}', {
        amount,
      })}
    </Typography>
  );
}

const ReferralAgentRow: React.FC<{ agent: TopAgentEntry; rank: number }> = ({
  agent,
  rank,
}) => {
  const [open, setOpen] = useState(false);
  const businesses = agent.referredBusinesses ?? [];
  return (
    <>
      <ReferralSummaryRow
        agent={agent}
        rank={rank}
        open={open}
        onToggle={() => setOpen((prev) => !prev)}
        disabled={businesses.length === 0}
      />
      <TableRow>
        <TableCell colSpan={11} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <ReferredBusinesses agent={agent} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

interface ReferralSummaryRowProps {
  agent: TopAgentEntry;
  rank: number;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
}

const ReferralSummaryRow: React.FC<ReferralSummaryRowProps> = ({
  agent,
  rank,
  open,
  disabled,
  onToggle,
}) => {
  const { t } = useTranslation();
  return (
    <TableRow hover>
      <TableCell padding="checkbox">
        <IconButton
          size="small"
          disabled={disabled}
          onClick={onToggle}
          aria-label={t(
            'admin.performance.topAgents.toggleBusinesses',
            'Show referred businesses'
          )}
        >
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </TableCell>
      <TableCell>{rank}</TableCell>
      <TableCell>{agentDisplayName(agent)}</TableCell>
      <TableCell>{agent.agentCode ?? '—'}</TableCell>
      <TableCell align="right">
        <Typography component="span" fontWeight={700}>
          {agent.score ?? 0}
        </Typography>
      </TableCell>
      <TableCell align="right">{agent.count}</TableCell>
      <TableCell align="right">{agent.inventoryItemsCount ?? 0}</TableCell>
      <TableCell align="right">
        <Chip
          size="small"
          color={agent.meetsGoldenRatio ? 'success' : 'default'}
          variant={agent.meetsGoldenRatio ? 'filled' : 'outlined'}
          label={agent.itemsPerReferral ?? 0}
        />
      </TableCell>
      <TableCell align="right">
        {agent.stockedReferralCount ?? 0}
        <Typography component="span" variant="caption" color="text.secondary">
          {` / ${agent.count}`}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <AgentEarnedCell agent={agent} />
      </TableCell>
    </TableRow>
  );
};

const ReferredBusinesses: React.FC<{ agent: TopAgentEntry }> = ({ agent }) => {
  const { t } = useTranslation();
  const businesses = agent.referredBusinesses ?? [];
  return (
    <Box sx={{ py: 1.5, pl: 4, pr: 1 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {t('admin.performance.topAgents.referredBusinesses', 'Referred businesses')}
      </Typography>
      {businesses.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('admin.performance.topAgents.noBusinesses', 'No referred businesses')}
        </Typography>
      ) : (
        <BusinessItemsTable agent={agent} />
      )}
    </Box>
  );
};

const BusinessItemsTable: React.FC<{ agent: TopAgentEntry }> = ({ agent }) => {
  const { t } = useTranslation();
  const businesses = agent.referredBusinesses ?? [];
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('admin.performance.topAgents.businessName', 'Business')}</TableCell>
          <TableCell align="right">{t('admin.performance.topAgents.itemsCount', 'Items')}</TableCell>
          <TableCell align="right">{t('admin.performance.topAgents.score', 'Score')}</TableCell>
          <TableCell align="center">
            {t('admin.performance.topAgents.itemsQualified', '10+ items')}
          </TableCell>
          <TableCell align="right">{t('admin.performance.topAgents.earned', 'Earned')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {businesses.map((biz) => (
          <BusinessItemRow key={biz.businessId} biz={biz} currency={agent.earnedCurrency} />
        ))}
      </TableBody>
    </Table>
  );
};

const BusinessItemRow: React.FC<{
  biz: NonNullable<TopAgentEntry['referredBusinesses']>[number];
  currency?: string;
}> = ({ biz, currency }) => {
  const { t } = useTranslation();
  const qualified = biz.itemCount >= GOLDEN_ITEMS_PER_REFERRAL;
  return (
    <TableRow>
      <TableCell>{biz.businessName || biz.businessId}</TableCell>
      <TableCell align="right">{biz.itemCount}</TableCell>
      <TableCell align="right">{biz.score}</TableCell>
      <TableCell align="center">
        <Chip
          size="small"
          color={qualified ? 'success' : 'default'}
          variant={qualified ? 'filled' : 'outlined'}
          label={
            qualified
              ? t('admin.performance.topAgents.qualifiedYes', 'Qualified')
              : t('admin.performance.topAgents.qualifiedNo', 'Not yet')
          }
        />
      </TableCell>
      <TableCell align="right">
        {biz.earnedAmount && currency
          ? formatPayoutMoney(biz.earnedAmount, currency)
          : '—'}
      </TableCell>
    </TableRow>
  );
};

export const TopAgentsReferralsTable: React.FC<TopAgentsReferralsTableProps> = ({
  agents,
  emptyLabel,
  goldenOnly,
}) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <ReferralHeading goldenOnly={goldenOnly} />
        {agents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <ReferralRows agents={agents} />
        )}
      </CardContent>
    </Card>
  );
};

const ReferralHeading: React.FC<{ goldenOnly: boolean }> = ({ goldenOnly }) => {
  const { t } = useTranslation();
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Typography variant="h6" fontWeight={600}>
          {t(
            'admin.performance.topAgents.referralsTitle',
            'Top agents by business referrals'
          )}
        </Typography>
        {goldenOnly ? (
          <Chip
            size="small"
            color="success"
            icon={<CheckCircle />}
            label={t(
              'admin.performance.topAgents.goldenFilterActive',
              '≥{{n}} items / referral',
              { n: GOLDEN_ITEMS_PER_REFERRAL }
            )}
          />
        ) : null}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t(
          'admin.performance.topAgents.referralsHelp',
          'Score = sum of (items + 1) per referred business. Ranked by score. Items / referral target: ≥{{n}}.',
          { n: GOLDEN_ITEMS_PER_REFERRAL }
        )}
      </Typography>
    </>
  );
};

const ReferralRows: React.FC<{ agents: TopAgentEntry[] }> = ({ agents }) => {
  const { t } = useTranslation();
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>#</TableCell>
            <TableCell>{t('admin.performance.topAgents.agent', 'Agent')}</TableCell>
            <TableCell>{t('admin.performance.topAgents.code', 'Code')}</TableCell>
            <ScoreHeader />
            <TableCell align="right">
              {t('admin.performance.topAgents.referralsCount', 'Referrals')}
            </TableCell>
            <ItemsHeader />
            <RatioHeader />
            <StockedHeader />
            <EarnedHeader />
          </TableRow>
        </TableHead>
        <TableBody>
          {agents.map((agent, index) => (
            <ReferralAgentRow key={agent.agentId} agent={agent} rank={index + 1} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

function headerTip(title: string, label: string) {
  return (
    <TableCell align="right">
      <Tooltip title={title}>
        <span>{label}</span>
      </Tooltip>
    </TableCell>
  );
}

const ScoreHeader: React.FC = () => {
  const { t } = useTranslation();
  return headerTip(
    t(
      'admin.performance.topAgents.scoreTooltip',
      'Sum of (items + 1) across referred businesses'
    ),
    t('admin.performance.topAgents.score', 'Score')
  );
};

const ItemsHeader: React.FC = () => {
  const { t } = useTranslation();
  return headerTip(
    t(
      'admin.performance.topAgents.itemsTooltip',
      'Active sale items on businesses this agent referred'
    ),
    t('admin.performance.topAgents.itemsCount', 'Items')
  );
};

const RatioHeader: React.FC = () => {
  const { t } = useTranslation();
  return headerTip(
    t(
      'admin.performance.topAgents.itemsPerReferralTooltip',
      'Average items per referred business (goal ≥{{n}})',
      { n: GOLDEN_ITEMS_PER_REFERRAL }
    ),
    t('admin.performance.topAgents.itemsPerReferral', 'Items / referral')
  );
};

const StockedHeader: React.FC = () => {
  const { t } = useTranslation();
  return headerTip(
    t(
      'admin.performance.topAgents.stockedTooltip',
      'Referred businesses with ≥{{n}} sale items',
      { n: GOLDEN_ITEMS_PER_REFERRAL }
    ),
    t('admin.performance.topAgents.stockedReferrals', 'Stocked')
  );
};

const EarnedHeader: React.FC = () => {
  const { t } = useTranslation();
  return headerTip(
    t(
      'admin.performance.topAgents.earnedTooltip',
      'Credited representative compensation in this period (10-item bonus and 1% of sales). Upcoming is the sum of pending compensation events waiting for Saturday credit.'
    ),
    t('admin.performance.topAgents.earned', 'Earned')
  );
};
