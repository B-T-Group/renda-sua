import { render, screen, waitFor } from '@testing-library/react';
import AdminManageAgents from './AdminManageAgents';

const mockGetAdminAssignments = jest.fn();
const mockGetPermissions = jest.fn();
const mockFetchAgents = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('../../hooks/useDedicatedAgents', () => ({
  useDedicatedAgents: () => ({
    getAdminAssignments: mockGetAdminAssignments,
  }),
}));

jest.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    getPermissions: mockGetPermissions,
    isSuperuser: true,
    can: () => true,
  }),
}));

jest.mock('../../hooks/useAdminAgents', () => ({
  useAdminAgents: () => ({
    agents: [],
    total: 0,
    page: 1,
    limit: 20,
    search: '',
    unverifiedOnly: false,
    setPage: jest.fn(),
    setLimit: jest.fn(),
    setSearch: jest.fn(),
    setUnverifiedOnly: jest.fn(),
    loading: false,
    error: null,
    fetchAgents: mockFetchAgents,
    updateAgent: jest.fn(),
    setAgentInternal: jest.fn(),
    setUserInternal: jest.fn(),
    applyReferral: jest.fn(),
  }),
}));

jest.mock('../../hooks/useApiClient', () => ({
  useApiClient: () => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  }),
}));

jest.mock('../../hooks/useVehicleTypes', () => ({
  useVehicleTypes: () => ({
    vehicleTypes: [],
  }),
}));

jest.mock('../admin/dedicated-agents/AdminDedicatedAssignmentsSection', () => ({
  AdminDedicatedAssignmentsSection: () => (
    <div data-testid="dedicated-section">Dedicated Section</div>
  ),
}));

describe('AdminManageAgents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissions.mockResolvedValue({
      isSuperuser: true,
      canManageAgents: true,
    });
    mockGetAdminAssignments.mockResolvedValue({ assignments: [] });
  });

  it('hides dedicated tab on 404 or 403', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: { status: 404 },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      const tabs = screen.queryAllByRole('tab');
      const dedicatedTab = tabs.find((tab) => tab.textContent?.includes('Dedicated'));
      expect(dedicatedTab).toBeUndefined();
    });
  });

  it('shows dedicated tab when getAdminAssignments succeeds', async () => {
    mockGetAdminAssignments.mockResolvedValue({ assignments: [] });

    render(<AdminManageAgents />);

    await waitFor(() => {
      const tabs = screen.queryAllByRole('tab');
      const dedicatedTab = tabs.find((tab) => tab.textContent?.includes('Dedicated'));
      expect(dedicatedTab).toBeDefined();
    });
  });
});
