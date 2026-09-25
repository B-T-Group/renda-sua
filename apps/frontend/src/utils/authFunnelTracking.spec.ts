import {
  AUTH_GATE_PENDING_KEY,
  clearAuthGatePending,
  readAuthGatePending,
  stashAuthGatePending,
} from './authFunnelTracking';

describe('authFunnelTracking session helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and reads non-PII gate pending payload', () => {
    stashAuthGatePending({
      entry: 'save_favorites',
      shownAt: 1000,
      context: 'save_favorites',
      flag_on: false,
      auth_path: 'auth0_ul',
    });
    expect(readAuthGatePending()).toMatchObject({ entry: 'save_favorites' });
    clearAuthGatePending();
    expect(sessionStorage.getItem(AUTH_GATE_PENDING_KEY)).toBeNull();
  });
});
