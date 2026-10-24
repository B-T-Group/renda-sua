import { render, screen } from '@testing-library/react';
import React from 'react';
import { ClientMobileMoneyPhoneSection } from './ClientMobileMoneyPhoneSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('../../hooks/useMobilePaymentPhones', () => ({
  useMobilePaymentPhones: () => ({
    phones: [],
    loading: false,
    error: null,
    fetchPhones: jest.fn(),
    setDefaultPhone: jest.fn(),
    linkProfilePhone: jest.fn(),
  }),
}));

jest.mock('../dialogs/MobilePaymentPhoneVerifyModal', () => ({
  MobilePaymentPhoneVerifyModal: () => null,
}));

describe('ClientMobileMoneyPhoneSection Togo market', () => {
  it('shows the checkout linker for a Togo seller', () => {
    render(
      <ClientMobileMoneyPhoneSection
        variant="checkout"
        requireLinkedPhone
        profileCountry="TG"
      />
    );
    expect(
      screen.getByText('Link a Mobile Money number to continue.')
    ).toBeTruthy();
  });

  it('hides the section for a non-MoMo seller country', () => {
    const { container } = render(
      <ClientMobileMoneyPhoneSection
        variant="checkout"
        requireLinkedPhone
        profileCountry="CA"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
