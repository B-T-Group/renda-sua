import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import IncomingOrderOverlay from './IncomingOrderOverlay';

const mockInterrupt = {
  visible: true,
  order: {
    id: 'ord-1',
    order_number: 'ORD-1',
    current_status: 'pending',
    acceptance_state: 'awaiting_acceptance',
    total_amount: 5000,
    currency: 'XAF',
    order_items: [{ id: 'oi-1', item_name: 'Burger', quantity: 1 }],
    client: { user: { first_name: 'Ada', last_name: 'Lovelace' } },
  },
  uiState: 'active',
  message: null,
  secondsLeft: 120,
  showDeclineDialog: false,
  refreshPending: jest.fn(),
  dismiss: jest.fn(),
  openDeclineDialog: jest.fn(),
  closeDeclineDialog: jest.fn(),
  onDeclineSuccess: jest.fn(),
  confirm: jest.fn(),
  markBusy: jest.fn(),
};

jest.mock('../../hooks/useIncomingOrderInterrupt', () => ({
  useIncomingOrderInterrupt: () => mockInterrupt,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

jest.mock('../dialogs/CancellationReasonModal', () => () => null);

describe('IncomingOrderOverlay', () => {
  it('keeps the dialog open and ignores backdrop dismiss', () => {
    render(
      <MemoryRouter>
        <IncomingOrderOverlay />
      </MemoryRouter>
    );

    expect(screen.getByText('New order')).toBeTruthy();
    expect(screen.getByText('Confirm order')).toBeTruthy();
    expect(screen.getByText('Need more time')).toBeTruthy();
  });
});
