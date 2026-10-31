/**
 * Agent opportunities UX: explainer copy, preferred-slot hint, prefs-error
 * retry, Apply gating, photo-gate upload then apply once, Home card.
 */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import DedicatedHubScreen from '../DedicatedHubScreen';
import DedicatedOpportunityDetailScreen from '../DedicatedOpportunityDetailScreen';
import dedicatedAgentsService from '../../../services/dedicatedAgentsService';
import { __resetSlotPrefsCache } from '../../../hooks/useSlotPreferences';
import DedicatedOpportunitiesHomeCard from '../../../components/agent/DedicatedOpportunitiesHomeCard';
import type { DedicatedOpportunity } from '../../../types/dedicatedAgents';

jest.mock('../../../services/dedicatedAgentsService', () => ({
  __esModule: true,
  default: {
    getSlotPreferences: jest.fn(),
    updateSlotPreferences: jest.fn(),
    resumeAssignment: jest.fn(),
    getOpportunities: jest.fn(),
    getOpportunity: jest.fn(),
    applyToOpportunity: jest.fn(),
    getMyAssignments: jest.fn(),
    updateOffToday: jest.fn(),
  },
}));
jest.mock('../../../utils/dedicatedAgentsAnalytics', () =>
  new Proxy({}, { get: (t: any, p: string) => (p === '__esModule' ? true : (t[p] ??= jest.fn())) })
);
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false, isOnline: true }),
}));
jest.mock('../../../stores/RootStore', () => ({ useStore: () => ({ auth: { user: { id: 'u1' } } }) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (cb: () => any) => jest.requireActual('react').useEffect(cb, [cb]),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockPick = jest.fn();
jest.mock('../../../hooks/useProfilePhotoUpload', () => ({
  useProfilePhotoUpload: () => ({ pickAndUploadPhoto: (...a: any[]) => mockPick(...a), uploading: false, error: null }),
}));

const service = jest.mocked(dedicatedAgentsService);
const prefs = (m: boolean, a: boolean, e: boolean) => ({
  preferences: { morning: m, afternoon: a, evening: e },
  allOff: !m && !a && !e,
});
const navigation = { navigate: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) } as any;
const render = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);
const opportunity = (over: Partial<DedicatedOpportunity> = {}): DedicatedOpportunity => ({
  id: 'p1',
  status: 'open',
  storeName: 'Bio Market',
  address: { line1: null, city: 'Libreville', state: 'Estuaire' },
  distanceKm: null,
  slots: [{ slotKey: 'morning', startTime: '08:00', endTime: '12:00', pickupTime: '09:00' }],
  pay: 'standard',
  headcount: 1,
  acceptedCount: 0,
  daysOfWeek: [1],
  terms: null,
  application: null,
  termsUpdatedSinceApplied: false,
  disabledReason: null,
  ...over,
} as DedicatedOpportunity);
const detail = () => (
  <DedicatedOpportunityDetailScreen navigation={navigation} route={{ params: { postingId: 'p1' } } as any} />
);

beforeEach(() => {
  jest.clearAllMocks();
  __resetSlotPrefsCache();
});

describe('Dedicated hub copy + prefs', () => {
  it('explains postings, links to Availability, and offers retry when prefs fail', async () => {
    service.getSlotPreferences.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(prefs(true, true, true));
    service.getOpportunities.mockResolvedValue({ success: true, opportunities: [opportunity()] });
    await render(<DedicatedHubScreen navigation={navigation} route={{ params: undefined } as any} />);
    expect(await screen.findByTestId('opp-list-explainer')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('preferred-slots-hint-cta'));
    expect(navigation.navigate).toHaveBeenCalledWith('AgentAvailability');
    await fireEvent.press(await screen.findByTestId('dedicated-slot-chips-retry'));
    expect(await screen.findByTestId('dedicated-slot-chips')).toBeTruthy();
  });
});

describe('Opportunity detail', () => {
  it('shows the explainer and keeps Apply disabled until prefs load', async () => {
    let resolvePrefs: (v: any) => void = () => undefined;
    service.getSlotPreferences.mockReturnValue(new Promise((r) => (resolvePrefs = r)) as any);
    service.getOpportunity.mockResolvedValue({ success: true, opportunity: opportunity() });
    await render(detail());
    expect(await screen.findByTestId('opp-detail-explainer')).toBeTruthy();
    expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(true);
    resolvePrefs(prefs(true, false, false));
    await waitFor(() =>
      expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(false)
    );
  });

  it('photo gate: uploads as profile picture, then applies exactly once', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, true, true));
    service.getOpportunity.mockResolvedValue({ success: true, opportunity: opportunity() });
    service.applyToOpportunity
      .mockRejectedValueOnce(Object.assign(new Error('photo'), { status: 422, code: 'PROFILE_PHOTO_REQUIRED' }))
      .mockResolvedValue({ success: true } as any);
    mockPick.mockResolvedValue({ success: true });
    await render(detail());
    await waitFor(() =>
      expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(false)
    );
    await fireEvent.press(screen.getByTestId('apply-button'));
    await fireEvent.press(await screen.findByText('Gallery'));
    await waitFor(() => expect(service.applyToOpportunity).toHaveBeenCalledTimes(2));
    expect(mockPick).toHaveBeenCalledWith('gallery');
    expect(await screen.findByText('Application submitted')).toBeTruthy();
  });

  it('photo gate: shows the real upload error', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, true, true));
    service.getOpportunity.mockResolvedValue({ success: true, opportunity: opportunity() });
    service.applyToOpportunity.mockRejectedValue(
      Object.assign(new Error('photo'), { status: 422, code: 'PROFILE_PHOTO_REQUIRED' })
    );
    mockPick.mockResolvedValue({ success: false, error: 'Failed to upload photo to S3' });
    await render(detail());
    await waitFor(() =>
      expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(false)
    );
    await fireEvent.press(screen.getByTestId('apply-button'));
    await fireEvent.press(await screen.findByText('Camera'));
    expect(await screen.findByText('Failed to upload photo to S3')).toBeTruthy();
    expect(service.applyToOpportunity).toHaveBeenCalledTimes(1);
  });
});

describe('Home card', () => {
  it('shows the open-opportunity count and is hidden when there are none', async () => {
    const onPress = jest.fn();
    service.getOpportunities.mockResolvedValue({
      success: true,
      opportunities: [opportunity(), opportunity({ id: 'p2' }), opportunity({ id: 'p3', disabledReason: 'x' as any })],
    });
    await render(<DedicatedOpportunitiesHomeCard onPress={onPress} />);
    expect(await screen.findByText('2 delivery opportunities near you')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('home-dedicated-opportunities-card'));
    expect(onPress).toHaveBeenCalled();
  });
});
