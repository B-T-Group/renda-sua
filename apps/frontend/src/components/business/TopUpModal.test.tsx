import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TopUpModal from './TopUpModal';

// Mock all required hooks and contexts
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, options?: any) => {
      if (defaultValue) {
        return defaultValue.replace(/\{\{(\w+)\}\}/g, (_, k) => options?.[k] ?? '');
      }
      return key;
    },
  }),
}));

// Mock useApiClient
jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: jest.fn(() => null),
}));

// Mock contexts that PhoneInput uses
jest.mock('../../contexts/LoadingContext', () => ({
  useLoading: jest.fn(() => ({ isLoading: false })),
  LoadingProvider: ({ children }: any) => children,
}));

jest.mock('../../contexts/UserProfileContext', () => ({
  useUserProfileContext: jest.fn(() => ({
    profile: { id: 'user-1', phone_number: '+22878123456' },
    personas: ['client'],
    loading: false,
  })),
}));

jest.mock('../../hooks/useSupportedCountries', () => ({
  useSupportedCountries: jest.fn(() => ({
    countries: [
      { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
      { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
      { code: 'TG', name: 'Togo', flag: '🇹🇬' },
    ],
    loading: false,
  })),
}));

// Mock useMobilePaymentProviders - we'll control this in tests
let mockProvidersState = {
  providers: [{ name: 'fedapay', isAvailable: true }],
  isFedaPayAvailable: true,
  loading: false,
  error: null as string | null,
};

jest.mock('../../hooks/useMobilePaymentProviders', () => ({
  useMobilePaymentProviders: jest.fn(() => mockProvidersState),
}));

describe('TopUpModal - RTL Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnConfirm.mockResolvedValue(true);
    // Reset to FedaPay available
    mockProvidersState = {
      providers: [{ name: 'fedapay', isAvailable: true }],
      isFedaPayAvailable: true,
      loading: false,
      error: null,
    };
  });

  test('TG picker renders for Togo numbers when FedaPay is available', async () => {
    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+22878123456"
        currency="XOF"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Moov Money')).toBeInTheDocument();
      expect(screen.getByText('Mixx by Yas')).toBeInTheDocument();
    });
  });

  test('Moov number with Togocel selected shows mismatch warning and Send is disabled', async () => {
    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+22878123456"
        currency="XOF"
      />
    );

    // Wait for picker to render (Moov should be auto-selected for 78 prefix)
    await waitFor(() => {
      expect(screen.getByText('Moov Money')).toBeInTheDocument();
    });

    // Fill in amount
    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Manually select Togocel (wrong operator for 78 prefix)
    const togocelButton = screen.getByLabelText('Mixx by Yas');
    fireEvent.click(togocelButton);

    // Wait for mismatch warning
    await waitFor(() => {
      expect(
        screen.getByText(/does not match the phone number prefix/i)
      ).toBeInTheDocument();
    });

    // Send button should be disabled
    const sendButton = screen.getByRole('button', { name: /Send Payment Request/i });
    expect(sendButton.disabled).toBe(true);
  });

  test('Provider error shows unavailable alert and Send is disabled', async () => {
    mockProvidersState = {
      providers: [],
      isFedaPayAvailable: false,
      loading: false,
      error: 'Failed to load payment providers',
    };

    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+22878123456"
        currency="XOF"
      />
    );

    // Wait for unavailable alert
    await waitFor(() => {
      expect(screen.getByText(/not currently available/i)).toBeInTheDocument();
    });

    // Fill amount
    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Send button should be disabled
    const sendButton = screen.getByRole('button', { name: /Send Payment Request/i });
    expect(sendButton.disabled).toBe(true);
  });

  test('Inactive FedaPay shows unavailable alert and Send is disabled', async () => {
    mockProvidersState = {
      providers: [],
      isFedaPayAvailable: false,
      loading: false,
      error: null,
    };

    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+22878123456"
        currency="XOF"
      />
    );

    // Wait for unavailable alert
    await waitFor(() => {
      expect(screen.getByText(/not currently available/i)).toBeInTheDocument();
    });

    // Fill amount
    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Send button should be disabled
    const sendButton = screen.getByRole('button', { name: /Send Payment Request/i });
    expect(sendButton.disabled).toBe(true);
  });

  test('Valid TG submit calls onConfirm with fedapay provider', async () => {
    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+22878123456"
        currency="XOF"
      />
    );

    // Wait for picker
    await waitFor(() => {
      expect(screen.getByText('Moov Money')).toBeInTheDocument();
    });

    // Fill amount
    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: /Send Payment Request/i });
    fireEvent.click(sendButton);

    // Verify onConfirm called with 'fedapay'
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('+22878123456', '1000', 'fedapay');
    });
  });

  test('CM submit calls onConfirm with airtel-money (unchanged)', async () => {
    render(
      <TopUpModal
        open={true}
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
        userPhoneNumber="+237671234567"
        currency="XAF"
      />
    );

    // Fill amount
    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '1000' } });

    // Click send
    const sendButton = screen.getByRole('button', { name: /Send Payment Request/i });
    fireEvent.click(sendButton);

    // Verify onConfirm called with 'airtel-money'
    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith('+237671234567', '1000', 'airtel-money');
    });
  });
});
