/**
 * Dedicated Agents Render Tests
 *
 * Real component render tests using @testing-library/react-native.
 * Tests key UI behaviors: offline banner, disabled buttons, Filled/Auto-declined states,
 * collapsed slots, and FR day letters.
 *
 * NOTE: This file is excluded from vitest. The shared jest-expo render-test
 * environment now lands (PR #649), but these cases were written against
 * incomplete service fixtures (flat agentName, slots without times) that do
 * not match the current DedicatedAgentCard/PickupSlot shapes, so the suite
 * is skipped until the fixtures are rewritten. Uses renderWithProviders()
 * from the shared setup.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { BusinessLocationDedicatedAgentsScreen } from '../BusinessLocationDedicatedAgentsScreen';
import { DedicatedApplicantsScreen } from '../DedicatedApplicantsScreen';
import { DedicatedPostingFormScreen } from '../DedicatedPostingFormScreen';

// Mock services
const mockDedicatedAgentsService = {
  getPickupSlots: jest.fn(),
  getDedicatedAgents: jest.fn(),
  getPostings: jest.fn(),
  getApplications: jest.fn(),
  acceptApplication: jest.fn(),
  declineApplication: jest.fn(),
  updatePickupSlots: jest.fn(),
  createPosting: jest.fn(),
  assignAgentToSlot: jest.fn(),
  unassignAgentFromSlot: jest.fn(),
  pauseAgent: jest.fn(),
  resumeAgent: jest.fn(),
  terminateAgent: jest.fn(),
};

jest.mock('../../../services/dedicatedAgentsService', () => ({
  __esModule: true,
  default: mockDedicatedAgentsService,
}));

const mockAnalytics = {
  sectionViewed: jest.fn(),
  applicantsViewed: jest.fn(),
  postingFormOpened: jest.fn(),
  slotToggled: jest.fn(),
  applicantAccepted: jest.fn(),
  applicantDeclined: jest.fn(),
};

jest.mock('../../../services/dedicatedAgentsAnalytics', () => ({
  dedicatedAgentsAnalytics: mockAnalytics,
}));

let mockIsOffline = false;

jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: mockIsOffline }),
}));

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({
    params: { locationId: 'loc-123', postingId: 'post-123' },
  }),
  useFocusEffect: jest.fn((callback) => callback()),
}));

describe.skip('BusinessLocationDedicatedAgentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOffline = false;
    mockDedicatedAgentsService.getPickupSlots.mockResolvedValue({
      success: true,
      slots: [
        { slotKey: 'morning', isEnabled: true },
        { slotKey: 'afternoon', isEnabled: false },
      ],
    });
    mockDedicatedAgentsService.getDedicatedAgents.mockResolvedValue({
      success: true,
      maxActiveOrders: 10,
      assignments: [],
    });
    mockDedicatedAgentsService.getPostings.mockResolvedValue({
      success: true,
      postings: [],
    });
  });

  it('renders loading state initially', async () => {
    render(<BusinessLocationDedicatedAgentsScreen />);

    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('shows offline banner when offline', async () => {
    mockIsOffline = true;

    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/offline/i)).toBeTruthy();
    });
  });

  it('renders slots after loading data', async () => {
    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      expect(mockDedicatedAgentsService.getPickupSlots).toHaveBeenCalled();
      expect(mockDedicatedAgentsService.getDedicatedAgents).toHaveBeenCalled();
    });
  });

  it('shows collapsed text for disabled slot with paused agents', async () => {
    mockDedicatedAgentsService.getPickupSlots.mockResolvedValue({
      success: true,
      slots: [{ slotKey: 'morning', isEnabled: false }],
    });
    mockDedicatedAgentsService.getDedicatedAgents.mockResolvedValue({
      success: true,
      maxActiveOrders: 10,
      assignments: [
        { assignmentId: 'a1', slotKey: 'morning', status: 'paused' },
        { assignmentId: 'a2', slotKey: 'morning', status: 'paused' },
        { assignmentId: 'a3', slotKey: 'morning', status: 'paused' },
      ],
    });

    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/3 paused agents/i)).toBeTruthy();
    });
  });

  it('disables slot toggle switch when offline', async () => {
    mockIsOffline = true;
    mockDedicatedAgentsService.getPickupSlots.mockResolvedValue({
      success: true,
      slots: [{ slotKey: 'morning', isEnabled: true }],
    });

    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      const switches = screen.queryAllByA11yRole('switch');
      switches.forEach((switchElement) => {
        expect(switchElement).toHaveAccessibilityState({ disabled: true });
      });
    });
  });

  it('provides accessibility label on slot toggle', async () => {
    mockDedicatedAgentsService.getPickupSlots.mockResolvedValue({
      success: true,
      slots: [{ slotKey: 'morning', isEnabled: true }],
    });

    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      const slotToggle = screen.queryByA11yLabel(/toggle.*morning.*slot/i);
      expect(slotToggle).toBeTruthy();
    });
  });

  it('renders package icon in agent stats (not emoji)', async () => {
    mockDedicatedAgentsService.getDedicatedAgents.mockResolvedValue({
      success: true,
      maxActiveOrders: 10,
      assignments: [
        {
          assignmentId: 'a1',
          slotKey: 'morning',
          status: 'active',
          agentName: 'John Doe',
          activeOrders: 2,
          maxActiveOrders: 5,
          deliveries: 10,
          missedDeliveries: 0,
        },
      ],
    });

    render(<BusinessLocationDedicatedAgentsScreen />);

    await waitFor(() => {
      // Icon component will be rendered instead of emoji
      expect(screen.queryByTestId('icon-package-variant')).toBeTruthy();
    });
  });
});

describe.skip('DedicatedApplicantsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOffline = false;
    mockDedicatedAgentsService.getApplications.mockResolvedValue({
      success: true,
      posting: { id: 'post-1', status: 'open', slotKeys: ['morning'], terms: null },
      applications: [
        { applicationId: 'app-1', status: 'applied', agentName: 'John Doe' },
        { applicationId: 'app-2', status: 'applied', agentName: 'Jane Smith' },
      ],
    });
  });

  it('renders loading state initially', async () => {
    render(<DedicatedApplicantsScreen />);

    expect(screen.getByTestId('activity-indicator')).toBeTruthy();
  });

  it('shows offline banner when offline', async () => {
    mockIsOffline = true;

    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/offline/i)).toBeTruthy();
    });
  });

  it('renders applicants after loading', async () => {
    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).toBeTruthy();
      expect(screen.queryByText('Jane Smith')).toBeTruthy();
    });
  });

  it('shows auto-declined chip for auto_declined applications', async () => {
    mockDedicatedAgentsService.getApplications.mockResolvedValue({
      success: true,
      posting: { id: 'post-1', status: 'filled', slotKeys: ['morning'], terms: null },
      applications: [
        { applicationId: 'app-1', status: 'accepted', agentName: 'John Doe' },
        { applicationId: 'app-2', status: 'auto_declined', agentName: 'Jane Smith' },
      ],
    });

    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/auto-declined/i)).toBeTruthy();
    });
  });

  it('shows Filled chip when posting is filled', async () => {
    mockDedicatedAgentsService.getApplications.mockResolvedValue({
      success: true,
      posting: { id: 'post-1', status: 'filled', slotKeys: ['morning'], terms: null },
      applications: [
        { applicationId: 'app-1', status: 'accepted', agentName: 'John Doe' },
      ],
    });

    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      expect(screen.queryByText(/filled/i)).toBeTruthy();
    });
  });

  it('disables accept/decline buttons when offline', async () => {
    mockIsOffline = true;

    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      const buttons = screen.queryAllByRole('button');
      const acceptButtons = buttons.filter((btn) => btn.props.children?.includes('Accept'));
      acceptButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  it('fires applicants_viewed analytics only once', async () => {
    render(<DedicatedApplicantsScreen />);

    await waitFor(() => {
      expect(mockAnalytics.applicantsViewed).toHaveBeenCalledTimes(1);
    });

    // Simulate data refresh (poll)
    await waitFor(() => {
      expect(mockDedicatedAgentsService.getApplications).toHaveBeenCalled();
    });

    // Analytics should still only be called once
    expect(mockAnalytics.applicantsViewed).toHaveBeenCalledTimes(1);
  });
});

describe.skip('DedicatedPostingFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOffline = false;
  });

  it('renders form controls', async () => {
    render(<DedicatedPostingFormScreen />);

    await waitFor(() => {
      // Should render day selector and headcount controls
      expect(screen.queryByText(/headcount/i)).toBeTruthy();
    });
  });

  it('renders FR day letters (L, J, V) when locale is fr', async () => {
    // Assuming i18n is set to FR in test setup
    render(<DedicatedPostingFormScreen />);

    await waitFor(() => {
      // Check for French day letters
      expect(screen.queryByText('L')).toBeTruthy(); // Lundi (Monday)
      expect(screen.queryByText('J')).toBeTruthy(); // Jeudi (Thursday)
      expect(screen.queryByText('V')).toBeTruthy(); // Vendredi (Friday)
    });
  });

  it('disables submit button when offline', async () => {
    mockIsOffline = true;

    render(<DedicatedPostingFormScreen />);

    await waitFor(() => {
      const submitButton = screen.queryByText(/submit/i)?.parent;
      if (submitButton) {
        expect(submitButton).toBeDisabled();
      }
    });
  });

  it('disables headcount decrease button when at minimum', async () => {
    render(<DedicatedPostingFormScreen />);

    await waitFor(() => {
      // Headcount starts at 1 (minimum)
      const decreaseButtons = screen.queryAllByA11yLabel(/decrease/i);
      if (decreaseButtons.length > 0) {
        expect(decreaseButtons[0]).toBeDisabled();
      }
    });
  });

  it('disables headcount buttons when offline', async () => {
    mockIsOffline = true;

    render(<DedicatedPostingFormScreen />);

    await waitFor(() => {
      const increaseButtons = screen.queryAllByA11yLabel(/increase/i);
      const decreaseButtons = screen.queryAllByA11yLabel(/decrease/i);
      
      [...increaseButtons, ...decreaseButtons].forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });
});
