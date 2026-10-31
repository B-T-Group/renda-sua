/**
 * #594 addendum PR2 render tests: preferred-slot toggles + confirm-and-pause
 * (AC-P2–P4, P6), Resume gate (AC-P5) and greyed postings (AC-P14).
 */
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import AgentAvailabilityScreen from '../AgentAvailabilityScreen';
import DedicatedHubScreen from '../DedicatedHubScreen';
import DedicatedOpportunityDetailScreen from '../DedicatedOpportunityDetailScreen';
import dedicatedAgentsService from '../../../services/dedicatedAgentsService';
import { __resetSlotPrefsCache } from '../../../hooks/useSlotPreferences';
import type { DedicatedOpportunity, MyDedicatedAssignment } from '../../../types/dedicatedAgents';

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
jest.mock('../../../hooks/useProfilePhotoUpload', () => ({
  useProfilePhotoUpload: () => ({ pickAndUploadPhoto: jest.fn(), uploading: false, error: null }),
}));
jest.mock('../../../stores/RootStore', () => ({ useStore: () => ({ auth: { user: { id: 'u1' } } }) }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: () => undefined,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const service = jest.mocked(dedicatedAgentsService);
const prefs = (m: boolean, a: boolean, e: boolean) => ({
  preferences: { morning: m, afternoon: a, evening: e },
  allOff: !m && !a && !e,
});
const navigation = { navigate: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()) } as any;
const render = (ui: React.ReactElement) => renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);

const conflict = () =>
  Object.assign(new Error('conflict'), {
    status: 409,
    code: 'slot_has_dedicated_assignments',
    data: {
      code: 'slot_has_dedicated_assignments',
      slots: ['morning'],
      stores: [{ assignmentId: 'a1', locationId: 'l1', storeName: '', slotKey: 'morning' }],
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  __resetSlotPrefsCache();
});

describe('Settings → Availability', () => {
  it('renders 3 accessible toggles and saves ON instantly without confirm', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, false, true));
    service.updateSlotPreferences.mockResolvedValue({ ...prefs(true, true, true), pausedAssignmentIds: [] });
    await render(<AgentAvailabilityScreen />);
    expect(await screen.findByLabelText('Afternoon, off')).toBeTruthy();
    expect(screen.getByLabelText('Morning, on')).toBeTruthy();
    expect(screen.getByText("Times follow each store's local hours. Instant (ASAP) orders aren't affected.")).toBeTruthy();
    await fireEvent.press(screen.getByTestId('slot-toggle-afternoon'));
    await waitFor(() => expect(service.updateSlotPreferences).toHaveBeenCalledWith({ afternoon: true }));
    expect(await screen.findByText('Afternoon turned on')).toBeTruthy();
    expect(screen.queryByText('Turn off Afternoon?')).toBeNull();
  });

  it('shows the all-off banner', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(false, false, false));
    await render(<AgentAvailabilityScreen />);
    expect(await screen.findByText("All times are off. You'll only get instant (ASAP) orders.")).toBeTruthy();
  });

  it('confirms OFF only on 409 with stores, then resends confirmPause and toasts paused count', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, true, true));
    service.updateSlotPreferences
      .mockRejectedValueOnce(conflict())
      .mockResolvedValueOnce({ ...prefs(false, true, true), pausedAssignmentIds: ['a1'] });
    await render(<AgentAvailabilityScreen />);
    await fireEvent.press(await screen.findByTestId('slot-toggle-morning'));
    expect(await screen.findByText('Turn off Morning?')).toBeTruthy();
    // Empty storeName falls back to "a store"; toggle stays ON while asking.
    expect(screen.getByText(/dedicated agent for Morning at a store/)).toBeTruthy();
    expect(screen.getByLabelText('Morning, on')).toBeTruthy();
    await fireEvent.press(screen.getByText('Turn off and pause'));
    await waitFor(() =>
      expect(service.updateSlotPreferences).toHaveBeenLastCalledWith({ morning: false, confirmPause: true })
    );
    expect(await screen.findByText('Morning turned off · 1 assignment paused')).toBeTruthy();
    expect(screen.getByLabelText('Morning, off')).toBeTruthy();
  });

  it('Keep on leaves the toggle ON and sends nothing else', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, true, true));
    service.updateSlotPreferences.mockRejectedValueOnce(conflict());
    await render(<AgentAvailabilityScreen />);
    await fireEvent.press(await screen.findByTestId('slot-toggle-morning'));
    await fireEvent.press(await screen.findByText('Keep on'));
    await waitFor(() => expect(screen.queryByText('Turn off Morning?')).toBeNull());
    expect(service.updateSlotPreferences).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Morning, on')).toBeTruthy();
  });

  it('OFF without dedicated stores saves straight away', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, true, true));
    service.updateSlotPreferences.mockResolvedValue({ ...prefs(true, true, false), pausedAssignmentIds: [] });
    await render(<AgentAvailabilityScreen />);
    await fireEvent.press(await screen.findByTestId('slot-toggle-evening'));
    expect(await screen.findByText('Evening turned off')).toBeTruthy();
    expect(screen.queryByText('Turn off Evening?')).toBeNull();
  });
});

const assignment = (overrides: Partial<MyDedicatedAssignment> = {}): MyDedicatedAssignment => ({
  assignmentId: 'a1',
  locationId: 'l1',
  storeName: 'Bio Market',
  slotKey: 'morning',
  startTime: '08:00',
  endTime: '12:00',
  status: 'paused',
  pauseReason: 'paused_slot_off',
  source: 'posting_accept',
  offToday: false,
  activeOrders: 0,
  maxActiveOrders: 10,
  ...overrides,
});

const opportunity = (slotKeys: Array<'morning' | 'afternoon' | 'evening'>): DedicatedOpportunity => ({
  id: 'p1',
  status: 'open',
  storeName: 'Bio Market',
  address: { line1: null, city: 'Libreville', state: 'Estuaire' },
  distanceKm: null,
  slots: slotKeys.map((slotKey) => ({ slotKey, startTime: '08:00', endTime: '12:00', pickupTime: '09:00' })),
  pay: 'standard',
  headcount: 1,
  acceptedCount: 0,
  daysOfWeek: [1],
  terms: null,
  application: null,
  termsUpdatedSinceApplied: false,
  disabledReason: null,
});

describe('Dedicated tab', () => {
  it('Resume is disabled with a hint while the slot is off, then enabled once it is on', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(false, true, true));
    service.getMyAssignments.mockResolvedValue({ assignments: [assignment()] } as any);
    service.updateSlotPreferences.mockResolvedValue({ ...prefs(true, true, true), pausedAssignmentIds: [] });
    service.resumeAssignment.mockResolvedValue({ success: true, assignment: {} });
    await render(<DedicatedHubScreen navigation={navigation} route={{ params: { segment: 'stores' } } as any} />);
    expect(await screen.findByText('Paused — slot off')).toBeTruthy();
    expect(screen.getByText('Turn on Morning first')).toBeTruthy();
    const resume = screen.getByTestId('resume-a1');
    expect(resume.props.accessibilityState?.disabled).toBe(true);
    // Chip row on the Dedicated tab shares state with Settings (AC-P2).
    await fireEvent.press(screen.getByTestId('slot-toggle-morning'));
    await waitFor(() => expect(screen.queryByText('Turn on Morning first')).toBeNull());
    expect(screen.getByTestId('resume-a1').props.accessibilityState?.disabled).toBe(false);
    await fireEvent.press(screen.getByTestId('resume-a1'));
    expect(service.resumeAssignment).toHaveBeenCalledWith('a1');
  });

  it('greys a non-preferred posting with reason and Turn on {{slot}}', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, false, true));
    service.getOpportunities.mockResolvedValue({ opportunities: [opportunity(['morning', 'afternoon'])] } as any);
    service.updateSlotPreferences.mockResolvedValue({ ...prefs(true, true, true), pausedAssignmentIds: [] });
    await render(<DedicatedHubScreen navigation={navigation} route={{ params: undefined } as any} />);
    expect(await screen.findByText('Not in your preferred slots')).toBeTruthy();
    await fireEvent.press(screen.getByText('Turn on Afternoon'));
    await waitFor(() => expect(service.updateSlotPreferences).toHaveBeenCalledWith({ afternoon: true }));
    await waitFor(() => expect(screen.queryByText('Not in your preferred slots')).toBeNull());
  });

  it('detail: Apply stays disabled until every posting slot is preferred (AC-P14)', async () => {
    service.getSlotPreferences.mockResolvedValue(prefs(true, false, true));
    service.getOpportunity.mockResolvedValue({ opportunity: opportunity(['morning', 'afternoon']) } as any);
    service.updateSlotPreferences.mockResolvedValue({ ...prefs(true, true, true), pausedAssignmentIds: [] });
    await render(
      <DedicatedOpportunityDetailScreen navigation={navigation} route={{ params: { postingId: 'p1' } } as any} />
    );
    expect(await screen.findByTestId('posting-not-preferred')).toBeTruthy();
    expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByText('Turn on Afternoon'));
    await waitFor(() => expect(screen.queryByTestId('posting-not-preferred')).toBeNull());
    expect(screen.getByTestId('apply-button').props.accessibilityState?.disabled).toBe(false);
  });
});
