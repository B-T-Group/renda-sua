import { render, screen } from '@testing-library/react';
import DedicatedAgentCard from '../DedicatedAgentCard';
import type { DedicatedAgentCard as Agent } from '../../../../types/dedicatedAgents';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, d?: unknown) => (typeof d === 'string' ? d : key) }),
}));

const base: Agent = {
  assignmentId: 'as-1',
  slotKey: 'morning',
  status: 'paused',
  source: 'posting',
  assignedByRendasua: false,
  offToday: false,
  agent: { id: 'ag-1', firstName: 'Awa', lastName: 'N', photoUrl: null, isInternal: false } as Agent['agent'],
  activeOrders: 0,
  maxActiveOrders: 3,
  outstandingDedicatedOffers: 0,
  balanceCoversOrders: null,
  deliveries: 0,
  missedDeliveries: 0,
};

describe('DedicatedAgentCard (#594 addendum AC-P16)', () => {
  it('shows "Paused by agent" and no Resume when the agent turned the slot off', () => {
    render(<DedicatedAgentCard agent={{ ...base, pauseReason: 'paused_slot_off' }} onPauseResume={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Paused by agent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume agent/ })).toBeNull();
  });

  it('a business pause still shows "Paused" with Resume', () => {
    render(<DedicatedAgentCard agent={{ ...base, pauseReason: 'paused_business' }} onPauseResume={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume agent/ })).toBeInTheDocument();
  });
});
