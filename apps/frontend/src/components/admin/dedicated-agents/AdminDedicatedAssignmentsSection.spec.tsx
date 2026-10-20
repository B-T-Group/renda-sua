import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAssignments.mockResolvedValue({ assignments: [mockAssignment] });
  });

  it('renders assignments and shows busy spinner on pause action', async () => {
    let resolveUpdate: any;
    mockUpdateAdminAssignment.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const agentCells = await screen.findAllByText(/Doe/);
    expect(agentCells.length).toBeGreaterThan(0);

    const pauseButton = screen.getByLabelText(/pause/i);
    expect(pauseButton).toBeEnabled();
    
    fireEvent.click(pauseButton);

    await waitFor(() => expect(pauseButton).toBeDisabled());
    
    resolveUpdate({});
    await waitFor(() => expect(mockUpdateAdminAssignment).toHaveBeenCalled());
  });

  it('shows snackbar on 409 conflict and refetches', async () => {
    mockUpdateAdminAssignment.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'assignment_removed' },
      },
    });

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const pauseButton = screen.getByLabelText(/pause/i);
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalled();
      expect(mockGetAdminAssignments).toHaveBeenCalledTimes(2);
    });
  });

  it('disables remove confirm button during deletion', async () => {
    let resolveDelete: any;
    mockDeleteAdminAssignment.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      })
    );

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

    const removeButton = screen.getByLabelText(/remove/i);
    fireEvent.click(removeButton);

    await waitFor(() => expect(screen.getByText(/remove assignment/i)).toBeInTheDocument());

    const dialogRemoveButton = screen.getAllByRole('button').find(
      (btn) => btn.textContent === 'Remove' && btn.closest('.MuiDialog-root')
    );

    expect(dialogRemoveButton).toBeDefined();
    if (dialogRemoveButton) {
      fireEvent.click(dialogRemoveButton);
      await waitFor(() => expect(dialogRemoveButton).toBeDisabled());
      
      resolveDelete({});
      await waitFor(() => expect(mockDeleteAdminAssignment).toHaveBeenCalled());
    }
  });
});
