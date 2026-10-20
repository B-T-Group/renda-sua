import { BadRequestException } from '@nestjs/common';

export interface SuperUserAssignDto {
  locationId: string;
  agentId: string;
  slotKeys: string[];
}

export interface SetDedicatedAssignmentStatusDto {
  status: 'active' | 'paused';
}

export interface RemoveDedicatedAssignmentDto {
  reason?: string;
}

export interface UpdatePickupSlotsDto {
  slots: Array<{ slotKey: string; isEnabled?: boolean; pickupTime?: string | null }>;
  /** AC-B4: required (true) when turning off a slot that has active dedicated agents. */
  confirmPauseAgents?: boolean;
}

export interface SetOffTodayDto {
  off: boolean;
}

export function parseAssignmentStatus(raw: unknown): 'active' | 'paused' {
  if (raw === 'active' || raw === 'paused') return raw;
  throw new BadRequestException({ code: 'invalid_status', message: "status must be 'active' or 'paused'" });
}
