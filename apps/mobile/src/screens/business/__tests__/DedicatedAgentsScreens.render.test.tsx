/**
 * Dedicated Agents render tests (jest-expo, see PR #649).
 *
 * Renders the real business screens with the shared providers and asserts
 * visible behaviour: offline banner, disabled actions, Filled / Auto-declined
 * states, collapsed disabled slots and analytics firing once.
 * Fixtures follow the current types in src/types/dedicatedAgents.ts.
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/test-utils';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import BusinessLocationDedicatedAgentsScreen from '../BusinessLocationDedicatedAgentsScreen';
import DedicatedApplicantsScreen, { ApplicantAvatar } from '../DedicatedApplicantsScreen';
import DedicatedPostingFormScreen from '../DedicatedPostingFormScreen';
import dedicatedAgentsService from '../../../services/dedicatedAgentsService';
import { dedicatedAgentsAnalytics } from '../../../services/dedicatedAgentsAnalytics';
import type {
  ApplicantCard,
  DedicatedAgentCard,
  DedicatedPostingView,
  PickupSlot,
  SlotKey,
} from '../../../types/dedicatedAgents';

// Factory mocks: the real modules pull in native-only storage/auth code.
jest.mock('../../../services/dedicatedAgentsService', () => ({
  __esModule: true,
  default: {
    getPickupSlots: jest.fn(),
    updatePickupSlots: jest.fn(),
    getDedicatedAgents: jest.fn(),
    updateAssignment: jest.fn(),
    deleteAssignment: jest.fn(),
    getPostings: jest.fn(),
    createPosting: jest.fn(),
    updatePosting: jest.fn(),
    closePosting: jest.fn(),
    getApplications: jest.fn(),
    acceptApplication: jest.fn(),
    declineApplication: jest.fn(),
  },
}));
jest.mock('../../../services/dedicatedAgentsAnalytics', () => ({
  dedicatedAgentsAnalytics: new Proxy({} as Record<string, jest.Mock>, {
    get: (target, prop: string) => (target[prop] ??= jest.fn()),
  }),
}));

let mockIsOffline = false;
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: mockIsOffline, isOnline: !mockIsOffline }),
}));

const service = jest.mocked(dedicatedAgentsService);
const analytics = jest.mocked(dedicatedAgentsAnalytics);

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
} as any;

function renderScreen(ui: React.ReactElement) {
  return renderWithProviders(<ThemeProvider>{ui}</ThemeProvider>);
}

const slot = (slotKey: SlotKey, isEnabled: boolean): PickupSlot => ({
  slotKey,
  isEnabled,
  startTime: '08:00',
  endTime: '12:00',
  pickupTime: '09:00',
  liveAgents: 0,
});

const card = (id: string, slotKey: SlotKey, status: 'active' | 'paused'): DedicatedAgentCard => ({
  assignmentId: id,
  slotKey,
  status,
  source: 'posting_accept',
  assignedByRendasua: false,
  offToday: false,
  agent: { id: `ag-${id}`, firstName: `Agent${id}`, lastName: 'X', photoUrl: null, isInternal: false },
  activeOrders: 1,
  maxActiveOrders: 5,
  outstandingDedicatedOffers: 0,
  balanceCoversOrders: null,
  deliveries: 10,
  missedDeliveries: 0,
});

const posting = (overrides: Partial<DedicatedPostingView> = {}): DedicatedPostingView => ({
  id: 'post-123',
  locationId: 'loc-123',
  status: 'open',
  headcount: 2,
  acceptedCount: 0,
  slotKeys: ['morning'],
  daysOfWeek: [1, 2, 3, 4, 5],
  terms: null,
  termsUpdatedAt: '2026-10-01T00:00:00Z',
  expiresAt: '2026-12-01T00:00:00Z',
  filledAt: null,
  closedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  pendingApplications: 2,
  ...overrides,
});

const applicant = (id: string, firstName: string, status: ApplicantCard['status']): ApplicantCard => ({
  applicationId: id,
  status,
  appliedAt: '2026-10-02T00:00:00Z',
  agent: { id: `ag-${id}`, firstName, lastName: 'Doe', photoUrl: null, joinedAt: '2026-01-01T00:00:00Z', isInternal: false },
  deliveriesCompleted: 12,
  missedDeliveries: 0,
  onTimePickupPct: 95,
  distanceKm: 1.5,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOffline = false;
});

describe('BusinessLocationDedicatedAgentsScreen', () => {
  const route = { key: 'r', name: 'BusinessLocationDedicatedAgents', params: { locationId: 'loc-123' } } as any;

  beforeEach(() => {
    service.getPickupSlots.mockResolvedValue({ success: true, slots: [slot('morning', true), slot('afternoon', false)] });
    service.getDedicatedAgents.mockResolvedValue({ success: true, maxActiveOrders: 10, assignments: [] });
    service.getPostings.mockResolvedValue({ success: true, postings: [] });
  });

  it('loads slots, agents and postings for the location', async () => {
    await renderScreen(<BusinessLocationDedicatedAgentsScreen route={route} navigation={navigation} />);
    expect(await screen.findByLabelText('Toggle Morning slot')).toBeTruthy();
    expect(service.getPickupSlots).toHaveBeenCalledWith('loc-123');
    expect(service.getDedicatedAgents).toHaveBeenCalledWith('loc-123');
    expect(service.getPostings).toHaveBeenCalledWith('loc-123');
  });

  it('shows the offline banner and disables slot toggles when offline', async () => {
    mockIsOffline = true;
    await renderScreen(<BusinessLocationDedicatedAgentsScreen route={route} navigation={navigation} />);
    expect(await screen.findByText('Offline · showing last update')).toBeTruthy();
    const toggles = screen.getAllByRole('switch', { name: /Toggle .* slot/ });
    expect(toggles.length).toBeGreaterThan(0);
    toggles.forEach((el) => expect(el.props.accessibilityState).toMatchObject({ disabled: true }));
  });

  it('keeps slot toggles enabled when online', async () => {
    await renderScreen(<BusinessLocationDedicatedAgentsScreen route={route} navigation={navigation} />);
    const toggle = await screen.findByLabelText('Toggle Morning slot');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true, disabled: false });
    expect(screen.queryByText('Offline · showing last update')).toBeNull();
  });

  it('collapses a disabled slot that still has paused agents', async () => {
    service.getPickupSlots.mockResolvedValue({ success: true, slots: [slot('morning', false)] });
    service.getDedicatedAgents.mockResolvedValue({
      success: true,
      maxActiveOrders: 10,
      assignments: [card('1', 'morning', 'paused'), card('2', 'morning', 'paused'), card('3', 'morning', 'paused')],
    });
    await renderScreen(<BusinessLocationDedicatedAgentsScreen route={route} navigation={navigation} />);
    await screen.findByLabelText('Toggle Morning slot');
    expect(screen.getByText(/3 paused/i)).toBeTruthy();
    expect(screen.queryByText(/Agent1/)).toBeNull();
  });

  it('#594 addendum AC-P16: shows "Paused by agent" for a slot-off pause', async () => {
    service.getDedicatedAgents.mockResolvedValue({
      success: true,
      maxActiveOrders: 10,
      assignments: [
        { ...card('1', 'morning', 'paused'), pauseReason: 'paused_slot_off' },
        card('2', 'morning', 'active'),
      ],
    });
    await renderScreen(<BusinessLocationDedicatedAgentsScreen route={route} navigation={navigation} />);
    expect(await screen.findByText('Paused by agent')).toBeTruthy();
  });
});

describe('DedicatedApplicantsScreen', () => {
  const route = {
    key: 'r',
    name: 'DedicatedApplicants',
    params: { locationId: 'loc-123', postingId: 'post-123' },
  } as any;

  beforeEach(() => {
    service.getApplications.mockResolvedValue({
      success: true,
      posting: posting(),
      applications: [applicant('app-1', 'John', 'applied'), applicant('app-2', 'Jane', 'applied')],
    });
  });

  it('renders pending applicants with enabled actions', async () => {
    await renderScreen(<DedicatedApplicantsScreen route={route} navigation={navigation} />);
    expect(await screen.findByText(/John/)).toBeTruthy();
    expect(screen.getByText(/Jane/)).toBeTruthy();
    const accepts = screen.getAllByRole('button', { name: 'Accept' });
    expect(accepts).toHaveLength(2);
    accepts.forEach((b) => expect(b.props.accessibilityState).toMatchObject({ disabled: false }));
  });

  it('disables accept and decline when offline', async () => {
    mockIsOffline = true;
    await renderScreen(<DedicatedApplicantsScreen route={route} navigation={navigation} />);
    expect(await screen.findByText('Offline · showing last update')).toBeTruthy();
    const buttons = [
      ...screen.getAllByRole('button', { name: 'Accept' }),
      ...screen.getAllByRole('button', { name: 'Decline' }),
    ];
    expect(buttons).toHaveLength(4);
    buttons.forEach((b) => expect(b.props.accessibilityState).toMatchObject({ disabled: true }));
  });

  it('shows Filled and auto-declined applicants for a filled posting, without actions', async () => {
    service.getApplications.mockResolvedValue({
      success: true,
      posting: posting({ status: 'filled', headcount: 1, acceptedCount: 1, filledAt: '2026-10-03T00:00:00Z' }),
      applications: [applicant('app-1', 'John', 'accepted'), applicant('app-2', 'Jane', 'auto_declined')],
    });
    await renderScreen(<DedicatedApplicantsScreen route={route} navigation={navigation} />);
    expect(await screen.findByText('Filled')).toBeTruthy();
    expect(screen.getAllByText(/auto-declined/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  });

  it('fires applicants_viewed once even when data reloads', async () => {
    const view = await renderScreen(<DedicatedApplicantsScreen route={route} navigation={navigation} />);
    await screen.findByText(/John/);
    expect(analytics.applicantsViewed).toHaveBeenCalledTimes(1);
    await view.rerender(
      <ThemeProvider>
        <DedicatedApplicantsScreen route={route} navigation={navigation} />
      </ThemeProvider>
    );
    await waitFor(() => expect(service.getApplications).toHaveBeenCalled());
    expect(analytics.applicantsViewed).toHaveBeenCalledTimes(1);
  });
});

describe('DedicatedPostingFormScreen', () => {
  const route = { key: 'r', name: 'DedicatedPostingForm', params: { locationId: 'loc-123' } } as any;

  beforeEach(() => {
    service.getPickupSlots.mockResolvedValue({ success: true, slots: [slot('morning', true), slot('evening', true)] });
    service.getPostings.mockResolvedValue({ success: true, postings: [] });
  });

  it('starts at headcount 1 with decrease disabled and increase enabled', async () => {
    await renderScreen(<DedicatedPostingFormScreen route={route} navigation={navigation} />);
    const dec = await screen.findByLabelText('Decrease count');
    const inc = screen.getByLabelText('Increase count');
    expect(dec.props.accessibilityState).toMatchObject({ disabled: true });
    expect(inc.props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(inc);
    expect(screen.getByLabelText('Decrease count').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('disables headcount controls when offline', async () => {
    mockIsOffline = true;
    await renderScreen(<DedicatedPostingFormScreen route={route} navigation={navigation} />);
    expect(await screen.findByText('Offline · showing last update')).toBeTruthy();
    expect(screen.getByLabelText('Increase count').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText('Decrease count').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('ApplicantAvatar', () => {
  it('renders the profile picture when photoUrl is present', async () => {
    await renderScreen(<ApplicantAvatar photoUrl="https://cdn.example/p.jpg" firstName="Awa" backgroundColor="#000" />);
    expect(screen.getByTestId('applicant-avatar-image')).toBeTruthy();
    expect(screen.queryByTestId('applicant-avatar-text')).toBeNull();
  });

  it('falls back to the initial when there is no photo', async () => {
    await renderScreen(<ApplicantAvatar photoUrl={null} firstName="Awa" backgroundColor="#000" />);
    expect(screen.getByTestId('applicant-avatar-text')).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
  });
});
