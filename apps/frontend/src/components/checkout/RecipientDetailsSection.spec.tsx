import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import RecipientDetailsSection from './RecipientDetailsSection';
import { EMPTY_RECIPIENT_DRAFT } from '../../utils/diasporaCheckout';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

jest.mock('../common/PhoneInput', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    label,
    helperText,
  }: {
    value?: string;
    onChange?: (v: string | undefined) => void;
    label?: string;
    helperText?: string;
  }) => (
    <div>
      <label htmlFor="recipient-phone">{label}</label>
      <input
        id="recipient-phone"
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <span>{helperText}</span>
    </div>
  ),
}));

describe('RecipientDetailsSection', () => {
  it('explains that the recipient needs no account', () => {
    render(
      <RecipientDetailsSection
        recipient={EMPTY_RECIPIENT_DRAFT}
        onChange={jest.fn()}
        fulfillmentCountry="GA"
      />
    );

    expect(
      screen.getByText(/no Rendasua account needed/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/receives their own delivery code/i)
    ).toBeTruthy();
  });

  it('flags the required fields while they are empty', () => {
    render(
      <RecipientDetailsSection
        recipient={EMPTY_RECIPIENT_DRAFT}
        onChange={jest.fn()}
        fulfillmentCountry="GA"
      />
    );

    expect(
      screen.getByText('The agent needs a name to hand the order to.')
    ).toBeTruthy();
    expect(
      screen.getByText('A local number in the delivery country is required.')
    ).toBeTruthy();
  });

  it('surfaces a server-side recipient blocker', () => {
    render(
      <RecipientDetailsSection
        recipient={{
          name: 'Awa Ndong',
          phone: '12',
          notifyWhatsapp: false,
        }}
        onChange={jest.fn()}
        fulfillmentCountry="GA"
        errorMessage="The recipient phone number is not a valid number for GA."
      />
    );

    expect(
      screen.getByText(
        'The recipient phone number is not a valid number for GA.'
      )
    ).toBeTruthy();
  });

  it('reports name edits to the parent', () => {
    const onChange = jest.fn();
    render(
      <RecipientDetailsSection
        recipient={EMPTY_RECIPIENT_DRAFT}
        onChange={onChange}
        fulfillmentCountry="GA"
      />
    );

    fireEvent.change(screen.getByLabelText(/Recipient full name/i), {
      target: { value: 'Awa Ndong' },
    });

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_RECIPIENT_DRAFT,
      name: 'Awa Ndong',
    });
  });

  it('reports the WhatsApp opt-in to the parent', () => {
    const onChange = jest.fn();
    render(
      <RecipientDetailsSection
        recipient={EMPTY_RECIPIENT_DRAFT}
        onChange={onChange}
        fulfillmentCountry="GA"
      />
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_RECIPIENT_DRAFT,
      notifyWhatsapp: true,
    });
  });
});
