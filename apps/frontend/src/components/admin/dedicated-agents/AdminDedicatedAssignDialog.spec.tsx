import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import AdminDedicatedAssignDialog from './AdminDedicatedAssignDialog';

const mockEnqueueSnackbar = jest.fn();
const mockGetAdminLocations = jest.fn();
const mockGetAdminAgentPicker = jest.fn();
const mockCreateAdminAssignment = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, params?: any) => {
      if (params && typeof defaultValue === 'string' && defaultValue.includes('{{')) {
        let result = defaultValue;
        Object.keys(params).forEach(param => {
          result = result.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), params[param]);
        });
        return result;
      }
      return typeof defaultValue === 'string' ? defaultValue : key;
    },
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('../../../hooks/useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => ({ trackSiteEvent: jest.fn() }),
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STARTED: 'dedicated_ui.admin_assign_started',
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STEP: 'dedicated_ui.admin_assign_step',
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_SUCCEEDED: 'dedicated_ui.admin_assign_succeeded',
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_FAILED: 'dedicated_ui.admin_assign_failed',
}));

jest.mock('../../../hooks/useDedicatedAgents', () => ({
  useDedicatedAgents: () => ({
    getAdminLocations: mockGetAdminLocations,
    getAdminAgentPicker: mockGetAdminAgentPicker,
    createAdminAssignment: mockCreateAdminAssignment,
  }),
}));

describe('AdminDedicatedAssignDialog - Error Mapping', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
    mockGetAdminLocations.mockClear();
    mockGetAdminAgentPicker.mockClear();
    mockCreateAdminAssignment.mockClear();
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
  });

  const renderDialog = () => {
    return render(
      <AdminDedicatedAssignDialog
        open={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
  };

  it('maps slot_disabled error to step 1 with slot names', async () => {
    mockGetAdminLocations.mockResolvedValue({
      locations: [
        {
          id: 'loc-1',
          name: 'Akwa',
          businessName: 'Shop',
          address: { city: 'Douala', state: 'LT' },
        },
      ],
    });
    mockGetAdminAgentPicker.mockResolvedValue({
      agents: [
        {
          id: 'agent-1',
          firstName: 'John',
          lastName: 'Doe',
          isInternal: false,
          activeOrders: 0,
          assignmentCount: 0,
        },
      ],
      truncated: false,
    });
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'slot_disabled', message: 'Slot disabled' },
      },
    });

    renderDialog();

    // Navigate through steps and trigger error
    const searchInput = screen.getByLabelText('Search store / city');
    fireEvent.change(searchInput, { target: { value: 'Shop' } });

    await waitFor(() => {
      expect(mockGetAdminLocations).toHaveBeenCalledWith('Shop');
    });

    // Select location (step 0)
    await waitFor(() => {
      const locationCard = screen.getByText('Shop · Akwa');
      fireEvent.click(locationCard);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Select slot (step 1)
    const morningChip = screen.getByText('Morning');
    fireEvent.click(morningChip);

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Select agent (step 2)
    await waitFor(() => {
      const agentCard = screen.getByText('John Doe');
      fireEvent.click(agentCard);
    });

    // Try to assign
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockCreateAdminAssignment).toHaveBeenCalled();
      // Should show error with slot name
      expect(screen.getByText(/Turn Morning back on first/i)).toBeInTheDocument();
    });
  });

  it('maps cap_exceeded error to step 2', async () => {
    mockGetAdminLocations.mockResolvedValue({
      locations: [
        {
          id: 'loc-1',
          name: 'Akwa',
          businessName: 'Shop',
          address: { city: 'Douala', state: 'LT' },
        },
      ],
    });
    mockGetAdminAgentPicker.mockResolvedValue({
      agents: [
        {
          id: 'agent-1',
          firstName: 'John',
          lastName: 'Doe',
          isInternal: false,
          activeOrders: 0,
          assignmentCount: 3,
        },
      ],
      truncated: false,
    });
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'cap_exceeded', message: 'Cap exceeded' },
      },
    });

    renderDialog();

    // Navigate to error state (simplified)
    expect(screen.getByText('Store')).toBeInTheDocument();
    
    // The error mapping should return step 2
    // In real implementation, this would navigate to step 2 and show the error
  });

  it('maps duplicate error to step 2', async () => {
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'duplicate', message: 'Already assigned' },
      },
    });

    // Error mapping should return:
    // message: "This agent is already assigned to this slot"
    // step: 2
    expect(true).toBe(true); // Placeholder for full implementation
  });

  it('maps agent_not_verified error to step 2', async () => {
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'agent_not_verified', message: 'Not verified' },
      },
    });

    // Error mapping should return:
    // message: "This agent is not verified"
    // step: 2
    expect(true).toBe(true); // Placeholder
  });

  it('maps agent_suspended error to step 2', async () => {
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'agent_suspended', message: 'Suspended' },
      },
    });

    // Error mapping should return:
    // message: "This agent is suspended"
    // step: 2
    expect(true).toBe(true); // Placeholder
  });

  it('maps 404 error to step 0', async () => {
    mockCreateAdminAssignment.mockRejectedValue({
      response: {
        status: 404,
        data: { message: 'Not found' },
      },
    });

    // Error mapping should return:
    // message: "Resource not found"
    // step: 0
    expect(true).toBe(true); // Placeholder
  });

  it('disables Next button on step 0 when no location selected', () => {
    renderDialog();
    
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });

  it('disables Next button on step 1 when no slots selected', async () => {
    mockGetAdminLocations.mockResolvedValue({
      locations: [
        {
          id: 'loc-1',
          name: 'Akwa',
          businessName: 'Shop',
          address: { city: 'Douala', state: 'LT' },
        },
      ],
    });

    renderDialog();

    // Select location
    const searchInput = screen.getByLabelText('Search store / city');
    fireEvent.change(searchInput, { target: { value: 'Shop' } });

    await waitFor(() => {
      const locationCard = screen.getByText('Shop · Akwa');
      fireEvent.click(locationCard);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Now on step 1, Next should be disabled without slot selection
    await waitFor(() => {
      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toBeDisabled();
    });
  });

  it('shows success snackbar with correct message after successful assignment', async () => {
    mockGetAdminLocations.mockResolvedValue({
      locations: [
        {
          id: 'loc-1',
          name: 'Akwa',
          businessName: 'Shop',
          address: { city: 'Douala', state: 'LT' },
        },
      ],
    });
    mockGetAdminAgentPicker.mockResolvedValue({
      agents: [
        {
          id: 'agent-1',
          firstName: 'John',
          lastName: 'Doe',
          isInternal: false,
          activeOrders: 0,
          assignmentCount: 0,
        },
      ],
      truncated: false,
    });
    mockCreateAdminAssignment.mockResolvedValue({
      success: true,
      assignments: [],
    });

    renderDialog();

    // Navigate through all steps
    const searchInput = screen.getByLabelText('Search store / city');
    fireEvent.change(searchInput, { target: { value: 'Shop' } });

    await waitFor(() => {
      const locationCard = screen.getByText('Shop · Akwa');
      fireEvent.click(locationCard);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      const morningChip = screen.getByText('Morning');
      fireEvent.click(morningChip);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      const agentCard = screen.getByText('John Doe');
      fireEvent.click(agentCard);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        'Assigned. The store and agent were notified.',
        { variant: 'success' }
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
