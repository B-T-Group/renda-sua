import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import AdminManageAgents from './AdminManageAgents';

const mockGetAdminAssignments = jest.fn();
const mockUpdateAgent = jest.fn();
const mockSetAgentInternal = jest.fn();
const mockSetUserInternal = jest.fn();
const mockApplyReferral = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    patch: jest.fn(),
  }),
}));

jest.mock('../../hooks/useAdminAgents', () => ({
  useAdminAgents: () => ({
    agents: [],
    total: 0,
    page: 1,
    limit: 10,
    search: '',
    unverifiedOnly: false,
    setPage: jest.fn(),
    setLimit: jest.fn(),
    setSearch: jest.fn(),
    setUnverifiedOnly: jest.fn(),
    loading: false,
    error: null,
    fetchAgents: jest.fn(),
    updateAgent: mockUpdateAgent,
    setAgentInternal: mockSetAgentInternal,
    setUserInternal: mockSetUserInternal,
    applyReferral: mockApplyReferral,
  }),
}));

jest.mock('../../hooks/useDedicatedAgents', () => ({
  useDedicatedAgents: () => ({
    getAdminAssignments: mockGetAdminAssignments,
  }),
}));

jest.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    isSuperuser: false,
    can: () => true,
  }),
}));

jest.mock('../../hooks/useVehicleTypes', () => ({
  useVehicleTypes: () => ({
    vehicleTypes: [
      { id: 'bike', comment: 'Bike' },
      { id: 'moto', comment: 'Motorcycle' },
    ],
  }),
}));

jest.mock('../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('../../hooks/useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => ({ trackSiteEvent: jest.fn() }),
  SITE_EVENT_DEDICATED_UI_SECTION_VIEWED: 'dedicated_ui.section_viewed',
  SITE_EVENT_DEDICATED_UI_AGENT_PAUSED: 'dedicated_ui.agent_paused',
  SITE_EVENT_DEDICATED_UI_AGENT_RESUMED: 'dedicated_ui.agent_resumed',
  SITE_EVENT_DEDICATED_UI_AGENT_REMOVED: 'dedicated_ui.agent_removed',
  SITE_EVENT_DEDICATED_UI_ACTION_CONFLICT: 'dedicated_ui.action_conflict',
}));

jest.mock('../admin/dedicated-agents/AdminDedicatedAssignmentsSection', () => ({
  AdminDedicatedAssignmentsSection: () => (
    <div data-testid="dedicated-section">Dedicated Assignments Section</div>
  ),
}));

jest.mock('../admin/AdminApplyReferralDialog', () => ({
  __esModule: true,
  AdminApplyReferralDialog: () => null,
}));

jest.mock('../common/AdminMessagePost', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../common/AdminUserCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../admin/AdminReferralMeta', () => ({
  __esModule: true,
  AdminReferralMeta: () => null,
}));

describe('AdminManageAgents - Tab Hide Logic', () => {
  beforeEach(() => {
    mockGetAdminAssignments.mockClear();
  });

  it('hides Dedicated tab on 404 error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should not be visible
      expect(screen.queryByRole('tab', { name: 'Dedicated' })).not.toBeInTheDocument();
    });

    // Should not show error state
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('hides Dedicated tab on 403 error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should not be visible
      expect(screen.queryByRole('tab', { name: 'Dedicated' })).not.toBeInTheDocument();
    });

    // Should not show error state
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('shows Dedicated tab and error state on 500 error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should still be visible
      expect(screen.getByRole('tab', { name: 'Dedicated' })).toBeInTheDocument();
    });

    // Click on Dedicated tab to see error
    const dedicatedTab = screen.getByRole('tab', { name: 'Dedicated' });
    dedicatedTab.click();

    await waitFor(() => {
      // Should show error state
      expect(screen.getByText(/Internal server error|Something went wrong/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('shows Dedicated tab and error state on network error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: {
        status: 0,
        data: { message: 'Network error' },
      },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should still be visible for non-403/404 errors
      expect(screen.getByRole('tab', { name: 'Dedicated' })).toBeInTheDocument();
    });
  });

  it('shows Dedicated tab on successful load', async () => {
    mockGetAdminAssignments.mockResolvedValue({
      assignments: [],
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should be visible
      expect(screen.getByRole('tab', { name: 'Dedicated' })).toBeInTheDocument();
    });

    // Click on Dedicated tab
    const dedicatedTab = screen.getByRole('tab', { name: 'Dedicated' });
    dedicatedTab.click();

    await waitFor(() => {
      // Should show the dedicated section without error
      expect(screen.getByTestId('dedicated-section')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  it('does not show error alert on All Agents tab when Dedicated tab has error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      // Tab should be visible
      expect(screen.getByRole('tab', { name: 'Dedicated' })).toBeInTheDocument();
    });

    // Should be on All Agents tab by default
    expect(screen.getByRole('tab', { name: 'All Agents', selected: true })).toBeInTheDocument();

    // Should not show error on All Agents tab
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
  });

  it('has proper aria-labels on tabs', async () => {
    mockGetAdminAssignments.mockResolvedValue({
      assignments: [],
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      const allAgentsTab = screen.getByRole('tab', { name: 'All Agents' });
      expect(allAgentsTab).toHaveAttribute('aria-label', 'All Agents');

      const dedicatedTab = screen.getByRole('tab', { name: 'Dedicated' });
      expect(dedicatedTab).toHaveAttribute('aria-label', 'Dedicated');
    });
  });
});
