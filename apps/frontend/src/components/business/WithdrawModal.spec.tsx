import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import WithdrawModal from './WithdrawModal';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('../common/PhoneInput', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    disabled,
    label,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    disabled?: boolean;
    label?: string;
  }) => (
    <input
      aria-label={label || 'phone'}
      data-testid="withdraw-phone"
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      value={value}
    />
  ),
}));

function renderModal(
  overrides: Partial<React.ComponentProps<typeof WithdrawModal>> = {}
) {
  const onConfirm = jest.fn().mockResolvedValue(true);
  const onClose = jest.fn();
  render(
    <WithdrawModal
      open
      onClose={onClose}
      onConfirm={onConfirm}
      currency="XAF"
      availableBalance={5000}
      {...overrides}
    />
  );
  return { onConfirm, onClose };
}

describe('WithdrawModal phone lock', () => {
  it('locks the saved Mobile Money number until Update is clicked', () => {
    renderModal({ userPhoneNumber: '+237670000000' });

    const phone = screen.getByTestId('withdraw-phone') as HTMLInputElement;
    expect(phone.value).toBe('+237670000000');
    expect(phone.disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(phone.disabled).toBe(false);
  });

  it('leaves the phone editable when no saved number exists', () => {
    renderModal();

    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(
      (screen.getByTestId('withdraw-phone') as HTMLInputElement).disabled
    ).toBe(false);
  });

  it('keeps submit disabled after unlocking a foreign payout number', () => {
    renderModal({ userPhoneNumber: '+237670000000' });

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    fireEvent.change(screen.getByTestId('withdraw-phone'), {
      target: { value: '+15551234567' },
    });
    fireEvent.change(screen.getByLabelText('accounts.amount'), {
      target: { value: '200' },
    });

    expect(
      (screen.getByRole('button', { name: 'accounts.withdraw' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('enables submit for a locked CM number and valid amount', () => {
    renderModal({ userPhoneNumber: '+237670000000' });

    fireEvent.change(screen.getByLabelText('accounts.amount'), {
      target: { value: '200' },
    });

    expect(
      (screen.getByRole('button', { name: 'accounts.withdraw' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });

  it('hides the phone lock in Stripe mode', () => {
    renderModal({ mode: 'stripe', userPhoneNumber: '+237670000000' });

    expect(screen.queryByTestId('withdraw-phone')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });
});
