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

  describe('admin routes (platform.manage.agents)', () => {
    it('reads the admin capability', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true, enabled: true, countries: ['CM'] });
      await dedicatedAgentsService.getAdminCapability();
      expect(api.get).toHaveBeenCalledWith('/admin/dedicated-agents/capability');
    });

    it('lists assignments with no query string when unfiltered', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true, assignments: [] });
      await dedicatedAgentsService.getAdminAssignments();
      expect(api.get).toHaveBeenCalledWith('/admin/dedicated-agents');
    });

    it('lists assignments with trimmed, encoded filters', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true, assignments: [] });
      await dedicatedAgentsService.getAdminAssignments({
        city: ' Saint-Denis ',
        slotKey: 'morning',
        status: 'paused',
        locationId: 'loc 1',
      });
      expect(api.get).toHaveBeenCalledWith(
        '/admin/dedicated-agents?city=Saint-Denis&locationId=loc+1&slotKey=morning&status=paused'
      );
    });

    it('reads coverage with and without a city', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true });
      await dedicatedAgentsService.getAdminCoverage();
      expect(api.get).toHaveBeenLastCalledWith('/admin/dedicated-agents/coverage');
      await dedicatedAgentsService.getAdminCoverage('Douala');
      expect(api.get).toHaveBeenLastCalledWith('/admin/dedicated-agents/coverage?city=Douala');
    });

    it('loads the agent picker for a store', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true, agents: [] });
      await dedicatedAgentsService.getAdminAgentPicker('loc-1');
      expect(api.get).toHaveBeenCalledWith('/admin/dedicated-agents/picker?locationId=loc-1');
    });

    it('searches stores with an encoded query, city and limit', async () => {
      vi.mocked(api.get).mockResolvedValue({ success: true, locations: [] });
      await dedicatedAgentsService.searchAdminLocations('café & co', { city: 'Yaoundé', limit: 20 });
      expect(api.get).toHaveBeenCalledWith(
        '/admin/dedicated-agents/locations?q=caf%C3%A9+%26+co&city=Yaound%C3%A9&limit=20'
      );
    });

    it('creates an assignment', async () => {
      vi.mocked(api.post).mockResolvedValue({ success: true, assignments: [] });
      const body = { locationId: 'loc-1', agentId: 'ag-1', slotKeys: ['morning' as const, 'evening' as const] };
      await dedicatedAgentsService.createAdminAssignment(body);
      expect(api.post).toHaveBeenCalledWith('/admin/dedicated-agents/assignments', body);
    });

    it('pauses or resumes an assignment with PATCH', async () => {
      vi.mocked(api.patch).mockResolvedValue({ success: true });
      await dedicatedAgentsService.updateAdminAssignment('as-1', { status: 'paused' });
      expect(api.patch).toHaveBeenCalledWith('/admin/dedicated-agents/assignments/as-1', {
        status: 'paused',
      });
    });

    it('removes an assignment without a body through api.delete', async () => {
      vi.mocked(api.delete).mockResolvedValue({ success: true });
      await dedicatedAgentsService.deleteAdminAssignment('as-1');
      expect(api.delete).toHaveBeenCalledWith('/admin/dedicated-agents/assignments/as-1');
      expect(apiRequest).not.toHaveBeenCalled();
    });

    it('removes an assignment with a reason as a DELETE JSON body', async () => {
      vi.mocked(apiRequest).mockResolvedValue({ success: true });
      await dedicatedAgentsService.deleteAdminAssignment('as-1', { reason: 'left' });
      expect(apiRequest).toHaveBeenCalledWith('/admin/dedicated-agents/assignments/as-1', {
        method: 'DELETE',
        body: JSON.stringify({ reason: 'left' }),
      });
      expect(api.delete).not.toHaveBeenCalled();
    });
  });
});
