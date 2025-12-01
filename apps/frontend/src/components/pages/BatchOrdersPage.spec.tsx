import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import BatchOrdersPage from './BatchOrdersPage';

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: () => ({ profile: { business: { id: 'b1', name: 'Test Biz' } } }),
}));

jest.mock('../../hooks', () => ({
  useOrders: () => ({ orders: [], loading: false, error: null }),
  useBatchOrderActions: () => ({
    batchStartPreparing: jest.fn(),
    batchCompletePreparation: jest.fn(),
    batchPickUp: jest.fn(),
    batchStartTransit: jest.fn(),
    batchOutForDelivery: jest.fn(),
    batchDeliver: jest.fn(),
  }),
}));

describe('BatchOrdersPage', () => {
  it('renders batch processing page for business user', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BatchOrdersPage />
      </I18nextProvider>
    );

    expect(
      screen.getByText(/Batch process business orders/i)
    ).toBeInTheDocument();
  });
});


