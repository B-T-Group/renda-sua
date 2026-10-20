import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import DedicatedOpportunityDetailScreen from './DedicatedOpportunityDetailScreen';
import * as dedicatedAgentsService from '../../services/dedicatedAgentsService';

vi.mock('../../services/dedicatedAgentsService');
vi.mock('../../stores/RootStore', () => ({
  useStore: () => ({
    auth: {
      user: { id: 'test-user' },
      setLocalProfilePhoto: vi.fn(),
    },
  }),
}));
vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false, isOnline: true }),
}));
vi.mock('../../hooks/useProfilePhotoUpload', () => ({
  useProfilePhotoUpload: () => ({
    pickAndUploadPhoto: vi.fn().mockResolvedValue(true),
    uploading: false,
    error: null,
  }),
}));

const mockNavigation = {
  navigate: vi.fn(),
  goBack: vi.fn(),
  setOptions: vi.fn(),
};

const mockRoute = {
  params: { postingId: 'test-posting-123' },
  key: 'test',
  name: 'DedicatedOpportunityDetail',
};

function renderWithNavigation(component: React.ReactElement) {
  return render(
    <NavigationContainer>
      {component}
    </NavigationContainer>
  );
}

describe('DedicatedOpportunityDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show 404 not found message on 404 error', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunityDetail: vi.fn().mockRejectedValue({
        response: { status: 404 },
      }),
    } as any);

    renderWithNavigation(
      <DedicatedOpportunityDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/this opportunity is no longer available/i)).toBeTruthy();
    });

    // Should not have Retry button for 404
    expect(screen.queryByText(/retry/i)).toBeNull();
  });

  it('should show noLongerAvailable plus Retry on 500 error', async () => {
    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue({
      getOpportunityDetail: vi.fn().mockRejectedValue({
        response: { status: 500 },
        message: 'Server error',
      }),
    } as any);

    renderWithNavigation(
      <DedicatedOpportunityDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/this opportunity is no longer available/i)).toBeTruthy();
    });

    // Should have Retry button for non-404 errors
    const retryButton = screen.getByText(/retry/i);
    expect(retryButton).toBeTruthy();
  });

  it('should keep photo gate sheet open and show Retry on apply failure', async () => {
    const mockService = {
      getOpportunityDetail: vi.fn().mockResolvedValue({
        id: 'test-posting-123',
        status: 'open',
        storeName: 'Test Store',
        address: { line1: '123 Main St', city: 'Test City', state: 'TC' },
        distanceKm: 5,
        slots: [{ slotKey: 'morning', startTime: '08:00', endTime: '12:00', pickupTime: '08:00' }],
        pay: 'XAF 5000',
        headcount: 2,
        acceptedCount: 1,
        daysOfWeek: ['monday', 'tuesday'],
        terms: null,
        application: null,
        disabledReason: null,
      }),
      applyToOpportunity: vi.fn().mockRejectedValue({
        response: {
          status: 422,
          data: { code: 'PROFILE_PHOTO_REQUIRED' },
        },
      }),
    };

    vi.spyOn(dedicatedAgentsService, 'default').mockReturnValue(mockService as any);

    renderWithNavigation(
      <DedicatedOpportunityDetailScreen navigation={mockNavigation as any} route={mockRoute as any} />
    );

    await waitFor(() => {
      expect(screen.getByText(/apply/i)).toBeTruthy();
    });

    // Click Apply button
    const applyButton = screen.getByText(/apply/i);
    fireEvent.press(applyButton);

    // Photo gate should open
    await waitFor(() => {
      expect(screen.getByText(/add a profile photo to apply/i)).toBeTruthy();
    });

    // Simulate photo upload success but apply failure
    mockService.applyToOpportunity.mockRejectedValueOnce({
      response: {
        status: 422,
        data: { code: 'posting_not_open' },
      },
    });

    const cameraButton = screen.getByText(/camera/i);
    fireEvent.press(cameraButton);

    // Sheet should stay open with error and Retry button
    await waitFor(() => {
      expect(screen.getByText(/retry/i)).toBeTruthy();
    });

    // Photo gate sheet should still be visible
    expect(screen.getByText(/add a profile photo to apply/i)).toBeTruthy();
  });
});
