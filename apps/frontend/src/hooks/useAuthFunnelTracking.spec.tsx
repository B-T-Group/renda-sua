import { renderHook, act } from '@testing-library/react';
import { useAuthFunnelTracking } from './useAuthFunnelTracking';

const mockTrackSiteEvent = jest.fn();
jest.mock('./useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => ({ trackSiteEvent: mockTrackSiteEvent }),
  SITE_EVENT_AUTH_GATE_SHOWN: 'auth_gate_shown',
  SITE_EVENT_AUTH_GATE_DISMISSED: 'auth_gate_dismissed',
}));

jest.mock('./useClientFlags', () => ({
  useClientFlags: () => ({ flags: { auth_web_inapp_gates: false } }),
}));

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    loginWithRedirect: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('useAuthFunnelTracking', () => {
  beforeEach(() => {
    mockTrackSiteEvent.mockClear();
    sessionStorage.clear();
  });

  it('fires auth_gate_shown with non-PII metadata', () => {
    const { result } = renderHook(() => useAuthFunnelTracking('foods_page'));
    act(() => {
      result.current.trackAuthGateShown('foods_order');
    });
    expect(mockTrackSiteEvent).toHaveBeenCalledWith({
      eventType: 'auth_gate_shown',
      metadata: expect.objectContaining({
        entry: 'foods_order',
        platform: 'web',
        auth_path: 'auth0_ul',
        flag_on: false,
      }),
    });
    expect(sessionStorage.getItem('rsAuthGatePending')).toContain('foods_order');
  });
});
