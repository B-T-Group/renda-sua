import { act, render } from '@testing-library/react';
import {
  CLIENT_FLAGS_WAIT_MS,
  __resetClientFlagsCache,
  useClientFlags,
} from './useClientFlags';

const mockGet = jest.fn();
const mockApiClient = { get: (...args: unknown[]) => mockGet(...args) };
jest.mock('./useApiClient', () => ({
  useApiClient: () => mockApiClient,
}));
jest.mock('../utils/marketStorage', () => ({
  readBootstrapCountryCode: () => 'CM',
}));

type Seen = { launcher: boolean; loaded: boolean };
function Probe({ id, seen }: { id: string; seen: Record<string, Seen> }) {
  const { flags, loaded } = useClientFlags();
  seen[id] = { launcher: flags.assistant_launcher_v1, loaded };
  return null;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flagsResponse = (on: boolean) => ({
  data: { success: true, data: { assistant_launcher_v1: on } },
});

beforeEach(() => {
  jest.useFakeTimers();
  __resetClientFlagsCache();
  mockGet.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('useClientFlags', () => {
  it('dedupes: several consumers share one request per country', async () => {
    const d = deferred<ReturnType<typeof flagsResponse>>();
    mockGet.mockReturnValue(d.promise);
    const seen: Record<string, Seen> = {};
    render(
      <>
        <Probe id="a" seen={seen} />
        <Probe id="b" seen={seen} />
        <Probe id="c" seen={seen} />
      </>
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/app-config/client-flags?country=CM');
    await act(async () => d.resolve(flagsResponse(true)));
    expect(seen.a).toEqual({ launcher: true, loaded: true });
    expect(seen.c).toEqual({ launcher: true, loaded: true });
  });

  it('a later mount reads the cached response synchronously (no refetch, no flash)', async () => {
    mockGet.mockResolvedValue(flagsResponse(true));
    const seen: Record<string, Seen> = {};
    const first = render(<Probe id="a" seen={seen} />);
    await act(async () => undefined);
    first.unmount();
    const firstRender: Seen[] = [];
    function Spy() {
      const { flags, loaded } = useClientFlags();
      firstRender.push({ launcher: flags.assistant_launcher_v1, loaded });
      return null;
    }
    render(<Spy />);
    expect(firstRender[0]).toEqual({ launcher: true, loaded: true });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('failure: loaded with the defaults, and the next mount retries', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    const seen: Record<string, Seen> = {};
    const r = render(<Probe id="a" seen={seen} />);
    await act(async () => undefined);
    expect(seen.a).toEqual({ launcher: false, loaded: true });
    r.unmount();
    mockGet.mockResolvedValueOnce(flagsResponse(true));
    render(<Probe id="b" seen={seen} />);
    await act(async () => undefined);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(seen.b).toEqual({ launcher: true, loaded: true });
  });

  it(`slow request: loaded after ${CLIENT_FLAGS_WAIT_MS} ms with the defaults; a late response still lands`, async () => {
    const d = deferred<ReturnType<typeof flagsResponse>>();
    mockGet.mockReturnValue(d.promise);
    const seen: Record<string, Seen> = {};
    render(<Probe id="a" seen={seen} />);
    expect(seen.a).toEqual({ launcher: false, loaded: false });
    act(() => {
      jest.advanceTimersByTime(CLIENT_FLAGS_WAIT_MS - 1);
    });
    expect(seen.a.loaded).toBe(false);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(seen.a).toEqual({ launcher: false, loaded: true });
    await act(async () => d.resolve(flagsResponse(true)));
    expect(seen.a).toEqual({ launcher: true, loaded: true });
  });
});
