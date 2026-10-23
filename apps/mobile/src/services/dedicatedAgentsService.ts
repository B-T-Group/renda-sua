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
} from '../types/dedicatedAgents';

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
}

export default new DedicatedAgentsService();
