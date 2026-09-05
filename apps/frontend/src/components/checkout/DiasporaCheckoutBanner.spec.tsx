import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import DiasporaCheckoutBanner from './DiasporaCheckoutBanner';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
      const template = typeof fallback === 'string' ? fallback : _key;
      const vars = (typeof fallback === 'string' ? opts : fallback) ?? {};
      return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(vars[k] ?? ''));
    },
  }),
}));

describe('DiasporaCheckoutBanner', () => {
  it('shows where the money leaves from and where the order lands', () => {
    render(
      <DiasporaCheckoutBanner
        payerCountry="CA"
        fulfillmentCountry="GA"
        crossBorder
        sendingToSomeoneElse={false}
        onSendingToSomeoneElseChange={jest.fn()}
      />
    );

    expect(screen.getByText('Paying from CA')).toBeTruthy();
    expect(screen.getByText('Delivering to GA')).toBeTruthy();
  });

  it('hides the country chips for a local order but keeps the toggle', () => {
    render(
      <DiasporaCheckoutBanner
        payerCountry="GA"
        fulfillmentCountry="GA"
        crossBorder={false}
        sendingToSomeoneElse={false}
        onSendingToSomeoneElseChange={jest.fn()}
      />
    );

    expect(screen.queryByText('Paying from GA')).toBeNull();
    expect(
      screen.getByText('Someone else is receiving this order')
    ).toBeTruthy();
  });

  it('reports the toggle change to the parent', () => {
    const onChange = jest.fn();
    render(
      <DiasporaCheckoutBanner
        payerCountry="CA"
        fulfillmentCountry="GA"
        crossBorder
        sendingToSomeoneElse={false}
        onSendingToSomeoneElseChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(true);
  });
});
