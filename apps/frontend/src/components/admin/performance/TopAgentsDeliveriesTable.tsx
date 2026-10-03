import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TopAgentEntry } from '../../../hooks/useAdminPerformance';

interface TopAgentsDeliveriesTableProps {
  agents: TopAgentEntry[];
  emptyLabel: string;
}

function agentDisplayName(agent: TopAgentEntry): string {
  return `${agent.firstName} ${agent.lastName}`.trim() || agent.agentId;
}

export const TopAgentsDeliveriesTable: React.FC<
  TopAgentsDeliveriesTableProps
> = ({ agents, emptyLabel }) => {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
          {t(
            'admin.performance.topAgents.deliveriesTitle',
            'Top agents by deliveries'
          )}
        </Typography>
        {agents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : (
          <DeliveriesRows agents={agents} />
        )}
      </CardContent>
    </Card>
  );
};

const DeliveriesRows: React.FC<{ agents: TopAgentEntry[] }> = ({ agents }) => {
  const { t } = useTranslation();
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>{t('admin.performance.topAgents.agent', 'Agent')}</TableCell>
            <TableCell>{t('admin.performance.topAgents.code', 'Code')}</TableCell>
            <TableCell align="right">
              {t('admin.performance.topAgents.deliveriesCount', 'Deliveries')}
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {agents.map((agent, index) => (
            <TableRow key={agent.agentId} hover>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{agentDisplayName(agent)}</TableCell>
              <TableCell>{agent.agentCode ?? '—'}</TableCell>
              <TableCell align="right">{agent.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
