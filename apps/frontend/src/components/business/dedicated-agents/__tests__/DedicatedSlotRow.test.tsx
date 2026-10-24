import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DedicatedSlotRow from '../DedicatedSlotRow';
import type { PickupSlot } from '../../../../types/dedicatedAgents';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string, params?: any) => {
      if (key === 'dedicatedAgents.slots.offConfirm') {
        return `Turn off ${params?.slot}? ${params?.n} dedicated agents will be paused.`;
      }
      if (key === 'dedicatedAgents.slots.morning') return 'Morning';
      if (key === 'common.cancel') return 'Cancel';
      if (key === 'common.confirm') return 'Confirm';
      if (key === 'dedicatedAgents.ariaLabels.slotToggle') return `Toggle ${params?.slot} slot`;
      if (key === 'dedicatedAgents.ariaLabels.pickupTimeSelect') return `Select pickup time for ${params?.slot}`;
      return defaultValue || key;
    },
  }),
}));

describe('DedicatedSlotRow - Slot Toggle Confirm/Revert', () => {
  const mockSlot: PickupSlot = {
    slotKey: 'morning',
    startTime: '07:00',
    endTime: '12:00',
    isEnabled: true,
    pickupTime: '07:30',
    liveAgents: 3,
  };

  let onToggleMock: jest.Mock;
  let onPickupTimeChangeMock: jest.Mock;

  beforeEach(() => {
    onToggleMock = jest.fn().mockResolvedValue(undefined);
    onPickupTimeChangeMock = jest.fn().mockResolvedValue({});
  });

  it('shows confirm dialog when turning off slot with live agents', async () => {
    render(
      <DedicatedSlotRow
        slot={mockSlot}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
      />
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/Turn off Morning\? 3 dedicated agents will be paused/)).toBeInTheDocument();
    });

    expect(onToggleMock).not.toHaveBeenCalled();
  });

  it('reverts switch when cancel is clicked in confirm dialog', async () => {
    render(
      <DedicatedSlotRow
        slot={mockSlot}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
      />
    );

    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    expect(toggle).toBeChecked();
    expect(onToggleMock).not.toHaveBeenCalled();
  });

  it('calls onToggle with false and confirmPauseAgents:true when confirm is clicked', async () => {
    render(
      <DedicatedSlotRow
        slot={mockSlot}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
      />
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText('Confirm')).toBeInTheDocument();
    });

    const confirmButton = screen.getByText('Confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onToggleMock).toHaveBeenCalledWith('morning', false, true);
    });
  });

  it('handles 409 error with agentsToPause from server', async () => {
    const slotWithNoAgents = {
      ...mockSlot,
      liveAgents: 0, // Start with no agents so no initial confirm
    };
    
    const error = {
      response: {
        data: {
          code: 'slot_has_dedicated_agents',
          agentsToPause: 5,
        },
      },
    };

    onToggleMock = jest.fn().mockRejectedValueOnce(error);

    render(
      <DedicatedSlotRow
        slot={slotWithNoAgents}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
      />
    );

    const toggle = screen.getByRole('checkbox');
    fireEvent.click(toggle);

    // The error triggers a confirm dialog with the server's agent count
    await waitFor(() => {
      expect(screen.getByText(/5 dedicated agents will be paused/)).toBeInTheDocument();
    });
  });

  it('toggles on without confirmation when no live agents', async () => {
    const slotWithNoAgents: PickupSlot = {
      ...mockSlot,
      isEnabled: false,
      liveAgents: 0,
    };

    render(
      <DedicatedSlotRow
        slot={slotWithNoAgents}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
      />
    );

    const toggle = screen.getByRole('checkbox');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(onToggleMock).toHaveBeenCalledWith('morning', true);
    });

    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
  });

  it('disables toggle when disabled prop is true', () => {
    render(
      <DedicatedSlotRow
        slot={mockSlot}
        onToggle={onToggleMock}
        onPickupTimeChange={onPickupTimeChangeMock}
        disabled
      />
    );

    const toggle = screen.getByRole('checkbox');
    expect(toggle).toBeDisabled();
  });
});
