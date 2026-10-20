import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AdminManageAgents } from './AdminManageAgents';

const mockGetAdminAssignments = jest.fn();
const mockGetPermissions = jest.fn();

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
  });

  it('hides dedicated tab on 403 error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: { status: 403 },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      const tabs = screen.queryAllByRole('tab');
      const dedicatedTab = tabs.find((tab) => tab.textContent?.includes('Dedicated'));
      expect(dedicatedTab).toBeUndefined();
    });
  });

  it('hides dedicated tab on 404 error', async () => {
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

  it('shows error with retry button on non-403/404 error', async () => {
    mockGetAdminAssignments.mockRejectedValue({
      response: { status: 500, data: { message: 'Server error' } },
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('shows dedicated section on success', async () => {
    mockGetAdminAssignments.mockResolvedValue({
      assignments: [],
    });

    render(<AdminManageAgents />);

    await waitFor(() => {
      expect(screen.getByTestId('dedicated-section')).toBeInTheDocument();
    });
  });
});
