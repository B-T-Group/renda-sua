import { renderHook } from '@testing-library/react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useAgentLocationConsent } from './useAgentLocationConsent';

jest.mock('./useApiClient', () => ({
  useApiClient: () => ({ patch: jest.fn() }),
}));

jest.mock('../contexts/UserProfileContext', () => ({
  useUserProfileContext: jest.fn(),
}));

describe('useAgentLocationConsent', () => {
  const mockedProfile = useUserProfileContext as jest.MockedFunction<
    typeof useUserProfileContext
  >;

  function mockProfile(overrides: {
    userType?: string;
    consent?: string | null;
    isDelegationContext?: boolean;
  }) {
    mockedProfile.mockReturnValue({
      userType: overrides.userType ?? 'agent',
      isDelegationContext: overrides.isDelegationContext ?? false,
      refetch: jest.fn(),
      profile: {
        agent: {
          location_tracking_consent_web: overrides.consent ?? 'not_shown',
        },
      },
    } as never);
  }

  it('shows disclosure only for an agent persona that has not consented', () => {
    mockProfile({ userType: 'agent', consent: 'not_shown' });
    const { result } = renderHook(() => useAgentLocationConsent());
    expect(result.current.showDisclosure).toBe(true);
  });

  it('hides disclosure when the session is a location delegation', () => {
    mockProfile({
      userType: 'agent',
      consent: 'not_shown',
      isDelegationContext: true,
    });
    const { result } = renderHook(() => useAgentLocationConsent());
    expect(result.current.showDisclosure).toBe(false);
  });

  it('hides disclosure after the agent already accepted', () => {
    mockProfile({ userType: 'agent', consent: 'accepted' });
    const { result } = renderHook(() => useAgentLocationConsent());
    expect(result.current.showDisclosure).toBe(false);
  });
});
