import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import { LoadingProvider } from '../contexts/LoadingContext';
import { TokenRefreshProvider } from '../contexts/TokenRefreshContext';
import {
  useCountryOnboardingConfig,
  CountryOnboardingConfig,
} from './useCountryOnboardingConfig';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <Auth0Provider
      domain="test"
      clientId="test"
      authorizationParams={{ redirect_uri: 'http://localhost' }}
    >
      <TokenRefreshProvider>
        <LoadingProvider>{children}</LoadingProvider>
      </TokenRefreshProvider>
    </Auth0Provider>
  </BrowserRouter>
);

describe('useCountryOnboardingConfig', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
  });

  it('should initialize with null data', () => {
    const { result } = renderHook(() => useCountryOnboardingConfig(), {
      wrapper,
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should set error when country code is missing', async () => {
    const { result } = renderHook(() => useCountryOnboardingConfig(), {
      wrapper,
    });

    await act(async () => {
      await result.current.fetchConfig('');
    });

    expect(result.current.error).toBe('Country code is required');
  });

  it('should handle successful applyConfig', async () => {
    const payload: CountryOnboardingConfig = {
      countryCode: 'GA',
      countryDeliveryConfig: null,
      deliveryTimeSlots: [],
      supportedStates: [],
    };

    mockedAxios.post.mockResolvedValue({
      data: { success: true },
    });

    const { result } = renderHook(() => useCountryOnboardingConfig(), {
      wrapper,
    });

    await act(async () => {
      const ok = await result.current.applyConfig(payload);
      expect(ok).toBe(true);
    });
  });
});

