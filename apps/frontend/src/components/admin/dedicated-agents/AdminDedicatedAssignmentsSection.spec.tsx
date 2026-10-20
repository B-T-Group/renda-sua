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
  default: ({ open, onSuccess }: { open: boolean; onSuccess: () => void }) =>
    open ? <div data-testid="assign-dialog">Dialog</div> : null,
}));

describe('AdminDedicatedAssignmentsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminAssignments.mockResolvedValue({
      assignments: [
        {
          assignmentId: 'a1',
          slotKey: 'morning',
          status: 'active',
          agent: { firstName: 'John', lastName: 'Doe', isInternal: false },
          location: { businessName: 'Shop', name: 'Akwa' },
        },
      ],
    });
  });

  it('shows busy spinner on pause/resume actions', async () => {
    mockUpdateAdminAssignment.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    
    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const pauseButton = screen.getAllByRole('button', { name: /pause/i })[0];
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(pauseButton).toBeDisabled();
    });

    await waitFor(() => {
      expect(mockUpdateAdminAssignment).toHaveBeenCalled();
    });
  });

  it('shows snackbar on 409 error with mapped message', async () => {
    mockUpdateAdminAssignment.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'assignment_removed', message: 'Removed' },
      },
    });

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const pauseButton = screen.getAllByRole('button', { name: /pause/i })[0];
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
        expect.any(String),
        { variant: 'error' }
      );
      expect(mockGetAdminAssignments).toHaveBeenCalledTimes(2); // Initial + refetch
    });
  });

  it('shows spinner in remove confirm dialog', async () => {
    mockDeleteAdminAssignment.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<AdminDedicatedAssignmentsSection />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: /remove/i })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByText(/remove assignment/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Remove' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
  });
});
