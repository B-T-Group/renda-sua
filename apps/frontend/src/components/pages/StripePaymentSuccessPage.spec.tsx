import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import StripePaymentSuccessPage from './StripePaymentSuccessPage';

const mockNavigate = jest.fn();
const mockCheckStatusByReference = jest.fn();
const mockSearchParamsHolder = {
  current: new URLSearchParams(),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParamsHolder.current],
}));

jest.mock('../../hooks/useStripePayments', () => ({
  useStripePayments: () => ({
    checkStatusByReference: mockCheckStatusByReference,
  }),
}));

describe('StripePaymentSuccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsHolder.current = new URLSearchParams(
      'reference=ST123&order=ORD-1&fulfillment=pickup'
    );
  });

  it('shows pickup charge-timing copy when fulfillment=pickup', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <StripePaymentSuccessPage />
      </I18nextProvider>
    );

    expect(
      screen.getByText(
        /You will only be charged when you collect your order at the store/i
      )
    ).toBeTruthy();
    expect(screen.queryByText(/delivery agent picks up/i)).toBeNull();
    expect(mockCheckStatusByReference).toHaveBeenCalledWith('ST123');
  });

  it('shows delivery charge-timing copy when fulfillment is absent', () => {
    mockSearchParamsHolder.current = new URLSearchParams(
      'reference=ST123&order=ORD-1'
    );

    render(
      <I18nextProvider i18n={i18n}>
        <StripePaymentSuccessPage />
      </I18nextProvider>
    );

    expect(
      screen.getByText(
        /You will only be charged when the delivery agent picks up your order from the business/i
      )
    ).toBeTruthy();
    expect(screen.queryByText(/collect your order at the store/i)).toBeNull();
  });

  it('keeps rental copy even if fulfillment=pickup is present', () => {
    mockSearchParamsHolder.current = new URLSearchParams(
      'reference=ST123&booking=bk-1&bookingNumber=RB-1&fulfillment=pickup'
    );

    render(
      <I18nextProvider i18n={i18n}>
        <StripePaymentSuccessPage />
      </I18nextProvider>
    );

    expect(
      screen.getByText(/Your rental payment was received/i)
    ).toBeTruthy();
    expect(screen.queryByText(/collect your order at the store/i)).toBeNull();
  });
});
