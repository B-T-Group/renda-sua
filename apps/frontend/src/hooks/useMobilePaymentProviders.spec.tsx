import { act, render } from '@testing-library/react';
import {
  useMobilePaymentProviders,
  type PaymentProvider,
} from './useMobilePaymentProviders';

const mockGet = jest.fn();
const mockApiClient = { get: (...args: unknown[]) => mockGet(...args) };

jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));

type Snapshot = ReturnType<typeof useMobilePaymentProviders>;

function Probe({
  country,
  seen,
}: {
  country?: string;
  seen: { current: Snapshot | null };
}) {
  seen.current = useMobilePaymentProviders(country);
  return null;
}

function provider(name: string, isAvailable: boolean): PaymentProvider {
  return {
    name,
    supportedMethods: ['mobile_money'],
    supportedCurrencies: ['XOF'],
    isAvailable,
  };
}

function axiosBody(body: unknown) {
  return { data: body };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockGet.mockReset();
});

describe('useMobilePaymentProviders', () => {
  it('does not fetch when no country is selected', async () => {
    const seen = { current: null as Snapshot | null };
    render(<Probe seen={seen} />);
    await act(async () => undefined);
    expect(mockGet).not.toHaveBeenCalled();
    expect(seen.current).toMatchObject({
      providers: [],
      loading: false,
      error: null,
      isFedaPayAvailable: false,
    });
  });

  it('reads the axios body and treats FedaPay as available only when the name matches and it is available', async () => {
    mockGet.mockResolvedValue(
      axiosBody({
        success: true,
        data: [provider('FedaPay', true), provider('mypvit', true)],
      })
    );
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);

    expect(mockGet).toHaveBeenCalledWith('/mobile-payments/providers?country=TG');
    expect(seen.current?.providers.map((p) => p.name)).toEqual(['FedaPay', 'mypvit']);
    expect(seen.current).toMatchObject({
      loading: false,
      error: null,
      isFedaPayAvailable: true,
    });
  });

  it('keeps FedaPay unavailable when the provider row is present but inactive', async () => {
    mockGet.mockResolvedValue(
      axiosBody({ success: true, data: [provider('fedapay', false)] })
    );
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current?.providers).toHaveLength(1);
    expect(seen.current?.isFedaPayAvailable).toBe(false);
    expect(seen.current?.error).toBeNull();
  });

  it('does not treat a lookalike provider name as FedaPay', async () => {
    mockGet.mockResolvedValue(
      axiosBody({ success: true, data: [provider('fedapay-tg', true)] })
    );
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current?.isFedaPayAvailable).toBe(false);
  });

  it('ignores a success flag that is not nested under the axios body', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [provider('fedapay', true)],
    });
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current).toMatchObject({
      providers: [],
      isFedaPayAvailable: false,
      error: 'Failed to load payment providers',
    });
  });

  it('reports an error when the body says the request failed', async () => {
    mockGet.mockResolvedValue(axiosBody({ success: false }));
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current).toMatchObject({
      providers: [],
      isFedaPayAvailable: false,
      error: 'Failed to load payment providers',
      loading: false,
    });
  });

  it('treats an empty provider list as a successful miss', async () => {
    mockGet.mockResolvedValue(axiosBody({ success: true, data: [] }));
    const seen = { current: null as Snapshot | null };
    render(<Probe country="CM" seen={seen} />);
    await act(async () => undefined);
    expect(mockGet).toHaveBeenCalledWith('/mobile-payments/providers?country=CM');
    expect(seen.current).toMatchObject({
      providers: [],
      error: null,
      isFedaPayAvailable: false,
      loading: false,
    });
  });

  it('stays loading until the request settles, then clears loading', async () => {
    const pending = deferred<ReturnType<typeof axiosBody>>();
    mockGet.mockReturnValue(pending.promise);
    const seen = { current: null as Snapshot | null };
    render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current?.loading).toBe(true);
    expect(seen.current?.isFedaPayAvailable).toBe(false);

    await act(async () => {
      pending.resolve(axiosBody({ success: true, data: [provider('fedapay', true)] }));
    });
    expect(seen.current).toMatchObject({
      loading: false,
      error: null,
      isFedaPayAvailable: true,
    });
  });

  it('uses the thrown message, and a fallback when the rejection has none', async () => {
    const seen = { current: null as Snapshot | null };
    mockGet.mockRejectedValueOnce(new Error('timeout'));
    const first = render(<Probe country="TG" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current).toMatchObject({
      providers: [],
      error: 'timeout',
      isFedaPayAvailable: false,
      loading: false,
    });

    first.unmount();
    mockGet.mockRejectedValueOnce('down');
    render(<Probe country="GA" seen={seen} />);
    await act(async () => undefined);
    expect(seen.current?.error).toBe('Failed to fetch payment providers');
    expect(mockGet).toHaveBeenLastCalledWith('/mobile-payments/providers?country=GA');
  });
});
