import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./apiClient', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  apiRequest: vi.fn(),
}));

import { api, apiRequest } from './apiClient';
import dedicatedAgentsService from './dedicatedAgentsService';

describe('DedicatedAgentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads pickup slots through the shared API client', async () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, slots: [] });
    await dedicatedAgentsService.getPickupSlots('loc-1');
    expect(api.get).toHaveBeenCalledWith('/business-locations/loc-1/pickup-slots');
  });

  it('patches a slot change as JSON on the shared client', async () => {
    vi.mocked(api.patch).mockResolvedValue({ success: true, slots: [] });
    const body = { slots: [{ slotKey: 'morning' as const, isEnabled: false }], confirmPauseAgents: true };
    await dedicatedAgentsService.updatePickupSlots('loc-1', body);
    expect(api.patch).toHaveBeenCalledWith('/business-locations/loc-1/pickup-slots', body);
  });

  it('applies to an opportunity on the agent route', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true, application: { id: 'app-1' } });
    await dedicatedAgentsService.applyToOpportunity('post-1');
    expect(api.post).toHaveBeenCalledWith('/agents/me/dedicated-opportunities/post-1/apply');
  });

  it('accepts an applicant on the business route', async () => {
    vi.mocked(api.post).mockResolvedValue({ success: true, application: {}, posting: {} });
    await dedicatedAgentsService.acceptApplication('loc-1', 'post-1', 'app-1');
    expect(api.post).toHaveBeenCalledWith(
      '/business-locations/loc-1/dedicated-postings/post-1/applications/app-1/accept'
    );
  });

  it('deletes an assignment without a body through api.delete', async () => {
    vi.mocked(api.delete).mockResolvedValue({ success: true });
    await dedicatedAgentsService.deleteAssignment('loc-1', 'as-1');
    expect(api.delete).toHaveBeenCalledWith(
      '/business-locations/loc-1/dedicated-agents/as-1'
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('sends a delete body when a reason is present', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ success: true });
    await dedicatedAgentsService.deleteAssignment('loc-1', 'as-1', { reason: 'left' });
    expect(apiRequest).toHaveBeenCalledWith(
      '/business-locations/loc-1/dedicated-agents/as-1',
      { method: 'DELETE', body: JSON.stringify({ reason: 'left' }) }
    );
  });

  it('encodes the capability country query', async () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, enabled: true, country: 'CM', reason: null });
    await dedicatedAgentsService.getCapability('CM');
    expect(api.get).toHaveBeenCalledWith('/dedicated-agents/capability?country=CM');
  });
});
