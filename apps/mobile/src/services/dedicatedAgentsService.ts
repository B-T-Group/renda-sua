/**
 * Dedicated-agent REST calls. Uses the shared Nest client so every request
 * follows the active environment and sends the persona or delegation header.
 */
import { api, apiRequest } from './apiClient';
import type {
  PickupSlotsResponse,
  DedicatedAgentsResponse,
  DedicatedPostingsResponse,
  DedicatedApplicationsResponse,
  UpdatePickupSlotsRequest,
  CreatePostingRequest,
  UpdatePostingRequest,
  ClosePostingRequest,
  UpdateAssignmentRequest,
  DeleteAssignmentRequest,
  DedicatedOpportunitiesResponse,
  DedicatedOpportunityResponse,
  MyDedicatedAssignmentsResponse,
  UpdateOffTodayRequest,
  DedicatedAgentsCapabilityResponse,
  AdminAssignmentsResponse,
  AdminAssignmentFilters,
  AdminAgentPickerResponse,
  AdminLocationsResponse,
  AdminDedicatedCapabilityResponse,
  CreateAdminAssignmentRequest,
  CreateAdminAssignmentResponse,
  AdminCoverageResponse,
  SlotPreferencesResponse,
  UpdateSlotPreferencesRequest,
} from '../types/dedicatedAgents';

export interface DedicatedHeadsUpResponse {
  success: true;
  headsUp: { status: 'sent' | 'unavailable'; dispatchReadyAt: string | null; active: boolean } | null;
}

export class DedicatedAgentsService {
  async getCapability(country?: string): Promise<DedicatedAgentsCapabilityResponse> {
    const url = country
      ? `/dedicated-agents/capability?${new URLSearchParams({ country }).toString()}`
      : `/agents/me/dedicated-agents/capability`;
    return api.get<DedicatedAgentsCapabilityResponse>(url);
  }

  async getPickupSlots(locationId: string): Promise<PickupSlotsResponse> {
    return api.get<PickupSlotsResponse>(`/business-locations/${locationId}/pickup-slots`);
  }

  async updatePickupSlots(
    locationId: string,
    data: UpdatePickupSlotsRequest
  ): Promise<PickupSlotsResponse> {
    return api.patch<PickupSlotsResponse>(
      `/business-locations/${locationId}/pickup-slots`,
      data
    );
  }

  async getDedicatedAgents(locationId: string): Promise<DedicatedAgentsResponse> {
    return api.get<DedicatedAgentsResponse>(
      `/business-locations/${locationId}/dedicated-agents`
    );
  }

  async updateAssignment(
    locationId: string,
    assignmentId: string,
    data: UpdateAssignmentRequest
  ): Promise<{ success: true }> {
    return api.patch<{ success: true }>(
      `/business-locations/${locationId}/dedicated-agents/${assignmentId}`,
      data
    );
  }

  async deleteAssignment(
    locationId: string,
    assignmentId: string,
    data?: DeleteAssignmentRequest
  ): Promise<{ success: true }> {
    const url = `/business-locations/${locationId}/dedicated-agents/${assignmentId}`;
    if (!data) return api.delete<{ success: true }>(url);
    return apiRequest<{ success: true }>(url, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  async getPostings(locationId: string): Promise<DedicatedPostingsResponse> {
    return api.get<DedicatedPostingsResponse>(
      `/business-locations/${locationId}/dedicated-postings`
    );
  }

  async createPosting(
    locationId: string,
    data: CreatePostingRequest
  ): Promise<{ success: true; posting: any }> {
    return api.post<{ success: true; posting: any }>(
      `/business-locations/${locationId}/dedicated-postings`,
      data
    );
  }

  async updatePosting(
    locationId: string,
    postingId: string,
    data: UpdatePostingRequest
  ): Promise<{ success: true }> {
    return api.patch<{ success: true }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}`,
      data
    );
  }

  async closePosting(
    locationId: string,
    postingId: string,
    data?: ClosePostingRequest
  ): Promise<{ success: true; posting: any; autoDeclined: number }> {
    return api.post<{ success: true; posting: any; autoDeclined: number }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/close`,
      data
    );
  }

  async getApplications(
    locationId: string,
    postingId: string
  ): Promise<DedicatedApplicationsResponse> {
    return api.get<DedicatedApplicationsResponse>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications`
    );
  }

  async acceptApplication(
    locationId: string,
    postingId: string,
    applicationId: string
  ): Promise<{ success: true; application: any; posting: any }> {
    return api.post<{ success: true; application: any; posting: any }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/accept`
    );
  }

  async declineApplication(
    locationId: string,
    postingId: string,
    applicationId: string
  ): Promise<{ success: true }> {
    return api.post<{ success: true }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/decline`
    );
  }

  async getOpportunities(): Promise<DedicatedOpportunitiesResponse> {
    return api.get<DedicatedOpportunitiesResponse>(`/agents/me/dedicated-opportunities`);
  }

  async getOpportunity(postingId: string): Promise<DedicatedOpportunityResponse> {
    return api.get<DedicatedOpportunityResponse>(
      `/agents/me/dedicated-opportunities/${postingId}`
    );
  }

  async applyToOpportunity(postingId: string): Promise<{ success: true; application: any }> {
    return api.post<{ success: true; application: any }>(
      `/agents/me/dedicated-opportunities/${postingId}/apply`
    );
  }

  async withdrawApplication(postingId: string): Promise<{ success: true }> {
    return api.post<{ success: true }>(
      `/agents/me/dedicated-opportunities/${postingId}/withdraw`
    );
  }

  async getMyAssignments(): Promise<MyDedicatedAssignmentsResponse> {
    return api.get<MyDedicatedAssignmentsResponse>(`/agents/me/dedicated-assignments`);
  }

  async updateOffToday(
    assignmentId: string,
    data: UpdateOffTodayRequest
  ): Promise<{ success: true }> {
    return api.patch<{ success: true }>(
      `/agents/me/dedicated-assignments/${assignmentId}/off-today`,
      data
    );
  }

  // #594 addendum: preferred delivery slots. PATCH turning a slot off with active
  // dedicated assignments throws 409 slot_has_dedicated_assignments (see
  // utils/slotPrefs#parseSlotOffConflict) until resent with confirmPause: true.
  /** Early heads-up for a covered scheduled order (null when this agent never got one). */
  async getHeadsUp(orderId: string): Promise<DedicatedHeadsUpResponse> {
    return api.get<DedicatedHeadsUpResponse>(`/agents/me/dedicated-heads-ups/${orderId}`);
  }

  /** "Can't take it": skip this agent for the order's dedicated dispatch. */
  async markHeadsUpUnavailable(orderId: string): Promise<{ success: true; status: 'unavailable' }> {
    return api.post<{ success: true; status: 'unavailable' }>(
      `/agents/me/dedicated-heads-ups/${orderId}/unavailable`
    );
  }

  async getSlotPreferences(): Promise<SlotPreferencesResponse> {
    return api.get<SlotPreferencesResponse>('/agents/me/slot-preferences');
  }

  async updateSlotPreferences(data: UpdateSlotPreferencesRequest): Promise<SlotPreferencesResponse> {
    return api.patch<SlotPreferencesResponse>('/agents/me/slot-preferences', data);
  }

  /** Resume an assignment paused by turning its slot off (slot must be on). */
  async resumeAssignment(assignmentId: string): Promise<{ success: true; assignment: unknown }> {
    return api.patch<{ success: true; assignment: unknown }>(
      `/agents/me/dedicated-assignments/${assignmentId}/resume`
    );
  }

  // -------------------------------------------------------------------------
  // Admin (platform.manage.agents). Routes 404 when dedicated_agents_enabled is
  // off for the store country; 403 when the store/agent is outside the geo scope.
  // -------------------------------------------------------------------------

  async getAdminCapability(): Promise<AdminDedicatedCapabilityResponse> {
    return api.get<AdminDedicatedCapabilityResponse>('/admin/dedicated-agents/capability');
  }

  async getAdminAssignments(filters?: AdminAssignmentFilters): Promise<AdminAssignmentsResponse> {
    const params = new URLSearchParams();
    if (filters?.city?.trim()) params.append('city', filters.city.trim());
    if (filters?.locationId) params.append('locationId', filters.locationId);
    if (filters?.slotKey) params.append('slotKey', filters.slotKey);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.prefOff) params.append('prefOff', filters.prefOff);
    if (filters?.pauseReason) params.append('pauseReason', filters.pauseReason);
    const query = params.toString();
    return api.get<AdminAssignmentsResponse>(`/admin/dedicated-agents${query ? `?${query}` : ''}`);
  }

  async getAdminCoverage(city?: string): Promise<AdminCoverageResponse> {
    const query = city?.trim() ? `?${new URLSearchParams({ city: city.trim() }).toString()}` : '';
    return api.get<AdminCoverageResponse>(`/admin/dedicated-agents/coverage${query}`);
  }

  async getAdminAgentPicker(locationId: string): Promise<AdminAgentPickerResponse> {
    const query = new URLSearchParams({ locationId }).toString();
    return api.get<AdminAgentPickerResponse>(`/admin/dedicated-agents/picker?${query}`);
  }

  /** Store search: the backend rejects queries under 2 characters with 400 query_too_short. */
  async searchAdminLocations(
    q: string,
    opts?: { city?: string; limit?: number }
  ): Promise<AdminLocationsResponse> {
    const params = new URLSearchParams({ q });
    if (opts?.city?.trim()) params.append('city', opts.city.trim());
    if (opts?.limit) params.append('limit', String(opts.limit));
    return api.get<AdminLocationsResponse>(`/admin/dedicated-agents/locations?${params.toString()}`);
  }

  async createAdminAssignment(
    data: CreateAdminAssignmentRequest
  ): Promise<CreateAdminAssignmentResponse> {
    return api.post<CreateAdminAssignmentResponse>('/admin/dedicated-agents/assignments', data);
  }

  async updateAdminAssignment(
    assignmentId: string,
    data: UpdateAssignmentRequest
  ): Promise<{ success: true }> {
    return api.patch<{ success: true }>(
      `/admin/dedicated-agents/assignments/${assignmentId}`,
      data
    );
  }

  async deleteAdminAssignment(
    assignmentId: string,
    data?: DeleteAssignmentRequest
  ): Promise<{ success: true }> {
    const url = `/admin/dedicated-agents/assignments/${assignmentId}`;
    if (!data) return api.delete<{ success: true }>(url);
    return apiRequest<{ success: true }>(url, {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }
}

export default new DedicatedAgentsService();
