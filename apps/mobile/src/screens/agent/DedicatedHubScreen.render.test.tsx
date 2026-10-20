import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import DedicatedHubScreen from './DedicatedHubScreen';
import * as dedicatedAgentsService from '../../services/dedicatedAgentsService';

vi.mock('../../services/dedicatedAgentsService');
vi.mock('../../stores/RootStore', () => ({
  useStore: () => ({
    auth: {
      user: { id: 'test-user', agent: {} },
    },
  }),
}));
vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false, isOnline: true }),
}));

const mockNavigation = {
  navigate: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
};

const mockRoute = {
  params: {},
  key: 'test',
  name: 'DedicatedHub',
};

function renderWithNavigation(component: React.ReactElement) {
  return render(
    <NavigationContainer>
      {component}
    </NavigationContainer>
  );
}

describe('DedicatedHubScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show no_address prompt with Add address button', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunities: vi.fn().mockRejectedValue({
        response: {
          status: 403,
          data: { code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'no_address' },
        },
      }),
    } as any);

    renderWithNavigation(
      <DedicatedHubScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/add your address to see stores/i)).toBeTruthy();
    });

    const addAddressButton = screen.getByText(/add address/i);
    expect(addAddressButton).toBeTruthy();

    fireEvent.press(addAddressButton);
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Profile');
  });

  it('should show gate for not_verified', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunities: vi.fn().mockRejectedValue({
        response: {
          status: 403,
          data: { code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'not_verified' },
        },
      }),
    } as any);

    renderWithNavigation(
      <DedicatedHubScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/get verified/i)).toBeTruthy();
    });
  });

  it('should show gate for contract_unsigned', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunities: vi.fn().mockRejectedValue({
        response: {
          status: 403,
          data: { code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'contract_unsigned' },
        },
      }),
    } as any);

    renderWithNavigation(
      <DedicatedHubScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/sign your agent agreement/i)).toBeTruthy();
    });
  });

  it('should show gate for suspended', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunities: vi.fn().mockRejectedValue({
        response: {
          status: 403,
          data: { code: 'DEDICATED_OPPORTUNITIES_NOT_ELIGIBLE', reason: 'suspended' },
        },
      }),
    } as any);

    renderWithNavigation(
      <DedicatedHubScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/your account is suspended/i)).toBeTruthy();
    });
  });
});
