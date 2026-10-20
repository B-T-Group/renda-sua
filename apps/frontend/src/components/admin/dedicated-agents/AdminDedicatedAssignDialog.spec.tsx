import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDedicatedAssignDialog from './AdminDedicatedAssignDialog';

const mockGetAdminLocations = jest.fn();
const mockGetAdminAgentPicker = jest.fn();
const mockCreateAdminAssignment = jest.fn();
const mockEnqueueSnackbar = jest.fn();
const mockTrackSiteEvent = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) =>
      typeof defaultValue === 'string' ? defaultValue : key,
  }),
}));

jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

jest.mock('../../../hooks/useDedicatedAgents', () => ({
  useDedicatedAgents: () => ({
    getAdminLocations: mockGetAdminLocations,
    getAdminAgentPicker: mockGetAdminAgentPicker,
    createAdminAssignment: mockCreateAdminAssignment,
  }),
}));

jest.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('../../../hooks/useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => ({ trackSiteEvent: mockTrackSiteEvent }),
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_STARTED: 'dedicated_ui.admin_assign_started',
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_SUCCEEDED: 'dedicated_ui.admin_assign_succeeded',
  SITE_EVENT_DEDICATED_UI_ADMIN_ASSIGN_FAILED: 'dedicated_ui.admin_assign_failed',
}));

describe('AdminDedicatedAssignDialog', () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  const mockLocation = {
    id: 'loc1',
    businessName: 'Shop',
    name: 'Akwa',
    address: { city: 'Douala', state: 'Littoral' },
  };

  const mockAgent = {
    id: 'ag1',
    firstName: 'Jane',
    lastName: 'Smith',
    isInternal: true,
    activeOrders: 2,
    assignmentCount: 0,
    balanceCoversOrders: null,
    photoUrl: null,
  };

  const mockAgentAtCapacity = {
    id: 'ag2',
    firstName: 'Bob',
    lastName: 'Brown',
    isInternal: false,
    activeOrders: 5,
    assignmentCount: 3,
    balanceCoversOrders: 2,
    photoUrl: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminLocations.mockResolvedValue({ locations: [mockLocation] });
    mockGetAdminAgentPicker.mockResolvedValue({
      agents: [mockAgent, mockAgentAtCapacity],
      truncated: false,
    });
  });

  it('disables Next button when no location is selected', () => {
    render(
      <AdminDedicatedAssignDialog
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toHaveAttribute('disabled');
  });

  it('maps 403 error to step 0 with error message', async () => {
    mockGetAdminLocations.mockRejectedValue({
      response: { status: 403, data: {} },
    });

    render(
      <AdminDedicatedAssignDialog
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const input = await screen.findByLabelText(/search store/i);
    fireEvent.change(input, { target: { value: 'Douala' } });

    await waitFor(() => {
      expect(screen.getByText('Outside your admin scope')).toBeInTheDocument();
    });
  });

  it('makes agents at 3/3 capacity unselectable with aria-disabled', async () => {
    render(
      <AdminDedicatedAssignDialog
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const input = await screen.findByLabelText(/search store/i);
    fireEvent.change(input, { target: { value: 'Shop' } });

    await waitFor(() => {
      expect(screen.getByText(/Shop · Akwa/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Shop · Akwa/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/morning/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/morning/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Bob Brown/i)).toBeInTheDocument();
    });

    const bobBox = screen.getByText(/Bob Brown/i).closest('[aria-disabled="true"]');
    expect(bobBox).toBeTruthy();

    const assignButton = screen.getByRole('button', { name: /assign/i });
    expect(assignButton).toHaveAttribute('disabled');
  });

  it('tracks failure with jumpedToStep metadata', async () => {
    mockCreateAdminAssignment.mockRejectedValue({
      response: { status: 400, data: { code: 'slot_disabled' } },
    });

    render(
      <AdminDedicatedAssignDialog
        open={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    const input = await screen.findByLabelText(/search store/i);
    fireEvent.change(input, { target: { value: 'Shop' } });

    await waitFor(() => {
      expect(screen.getByText(/Shop · Akwa/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Shop · Akwa/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/morning/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/morning/i));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Jane Smith/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Jane Smith/i));
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() => {
      expect(mockTrackSiteEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'dedicated_ui.admin_assign_failed',
          metadata: expect.objectContaining({
            code: 'slot_disabled',
            jumpedToStep: 1,
            role: 'superuser',
          }),
        })
      );
    });
  });
});
