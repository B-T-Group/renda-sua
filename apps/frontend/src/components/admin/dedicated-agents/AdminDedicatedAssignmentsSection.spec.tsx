import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminDedicatedAssignmentsSection } from './AdminDedicatedAssignmentsSection';

const mockGetAdminAssignments = jest.fn();
const mockUpdateAdminAssignment = jest.fn();
const mockDeleteAdminAssignment = jest.fn();
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
    getAdminAssignments: mockGetAdminAssignments,
    updateAdminAssignment: mockUpdateAdminAssignment,
    deleteAdminAssignment: mockDeleteAdminAssignment,
  }),
}));

jest.mock('../../../hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => true,
}));

jest.mock('../../../hooks/useTrackSiteEvent', () => ({
  useTrackSiteEvent: () => ({ trackSiteEvent: mockTrackSiteEvent }),
  SITE_EVENT_DEDICATED_UI_SECTION_VIEWED: 'dedicated_ui.section_viewed',
  SITE_EVENT_DEDICATED_UI_AGENT_PAUSED: 'dedicated_ui.agent_paused',
  SITE_EVENT_DEDICATED_UI_AGENT_RESUMED: 'dedicated_ui.agent_resumed',
  SITE_EVENT_DEDICATED_UI_AGENT_REMOVED: 'dedicated_ui.agent_removed',
  SITE_EVENT_DEDICATED_UI_ACTION_CONFLICT: 'dedicated_ui.action_conflict',
}));

jest.mock('./AdminDedicatedAssignDialog', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="assign-dialog">Dialog</div> : null,
}));

describe('AdminDedicatedAssignmentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAssignments.mockResolvedValue({ assignments: [] });
  });

  it('renders component with filters and controls', () => {
    render(<AdminDedicatedAssignmentsSection />);

    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign/i })).toBeInTheDocument();
  });

  it('tracks busy state during update to prevent double-submission', async () => {
    const mockAssignment = {
      assignmentId: 'a1',
      slotKey: 'morning',
      status: 'active' as const,
      agent: { firstName: 'John', lastName: 'Doe', isInternal: false },
      location: {
        businessName: 'Shop',
        name: 'Akwa',
        city: 'Douala',
        state: 'Littoral',
      },
    };

    mockGetAdminAssignments.mockResolvedValue({ assignments: [mockAssignment] });
    
    let resolveUpdate!: () => void;
    mockUpdateAdminAssignment.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByText(/doe/i)).toBeInTheDocument(), {
      timeout: 5000,
    });

    const pauseButton = screen.getByLabelText(/pause/i);
    expect(pauseButton).toBeEnabled();

    fireEvent.click(pauseButton);

    await waitFor(() => expect(pauseButton).toHaveAttribute('disabled'));

    resolveUpdate();

    await waitFor(() => expect(mockUpdateAdminAssignment).toHaveBeenCalled(), {
      timeout: 1000,
    });
  });

  it('shows snackbar on 409 conflict and refetches', async () => {
    const mockAssignment = {
      assignmentId: 'a1',
      slotKey: 'morning',
      status: 'active' as const,
      agent: { firstName: 'John', lastName: 'Doe', isInternal: false },
      location: {
        businessName: 'Shop',
        name: 'Akwa',
        city: 'Douala',
        state: 'Littoral',
      },
    };

    mockGetAdminAssignments.mockResolvedValue({ assignments: [mockAssignment] });
    mockUpdateAdminAssignment.mockRejectedValue({
      response: { status: 409, data: { code: 'assignment_removed' } },
    });

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByText(/doe/i)).toBeInTheDocument(), {
      timeout: 5000,
    });

    const pauseButton = screen.getByLabelText(/pause/i);
    fireEvent.click(pauseButton);

    await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockGetAdminAssignments).toHaveBeenCalledTimes(2);
  });

  it('disables remove button during deletion', async () => {
    const mockAssignment = {
      assignmentId: 'a1',
      slotKey: 'morning',
      status: 'active' as const,
      agent: { firstName: 'John', lastName: 'Doe', isInternal: false },
      location: {
        businessName: 'Shop',
        name: 'Akwa',
        city: 'Douala',
        state: 'Littoral',
      },
    };

    mockGetAdminAssignments.mockResolvedValue({ assignments: [mockAssignment] });
    let resolveDelete!: () => void;
    mockDeleteAdminAssignment.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByText(/doe/i)).toBeInTheDocument(), {
      timeout: 5000,
    });

    const removeButton = screen.getByLabelText(/remove/i);
    fireEvent.click(removeButton);

    await waitFor(() => expect(screen.getByText(/remove assignment/i)).toBeInTheDocument());

    const dialogButtons = screen.getAllByRole('button');
    const removeConfirm = dialogButtons.find(
      (btn) => btn.textContent === 'Remove' && btn.closest('.MuiDialog-root')
    );

    expect(removeConfirm).toBeDefined();
    fireEvent.click(removeConfirm!);
    await waitFor(() => expect(removeConfirm).toHaveAttribute('disabled'));
    resolveDelete();
  });
});
