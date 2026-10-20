import apiService from './apiService';
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
      ? `/dedicated-agents/capability?country=${country}`
      : `/agents/me/dedicated-agents/capability`;
    return apiService.get<DedicatedAgentsCapabilityResponse>(url);
  }

  async getPickupSlots(locationId: string): Promise<PickupSlotsResponse> {
    return apiService.get<PickupSlotsResponse>(
      `/business-locations/${locationId}/pickup-slots`
    );
  }

  async updatePickupSlots(
    locationId: string,
    data: UpdatePickupSlotsRequest
  ): Promise<PickupSlotsResponse> {
    return apiService.request<PickupSlotsResponse>(
      `/business-locations/${locationId}/pickup-slots`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async getDedicatedAgents(locationId: string): Promise<DedicatedAgentsResponse> {
    return apiService.get<DedicatedAgentsResponse>(
      `/business-locations/${locationId}/dedicated-agents`
    );
  }

  async updateAssignment(
    locationId: string,
    assignmentId: string,
    data: UpdateAssignmentRequest
  ): Promise<{ success: true }> {
    return apiService.request<{ success: true }>(
      `/business-locations/${locationId}/dedicated-agents/${assignmentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async deleteAssignment(
    locationId: string,
    assignmentId: string,
    data?: DeleteAssignmentRequest
  ): Promise<{ success: true }> {
    return apiService.request<{ success: true }>(
      `/business-locations/${locationId}/dedicated-agents/${assignmentId}`,
      {
        method: 'DELETE',
        body: data ? JSON.stringify(data) : undefined,
      }
    );
  }

  async getPostings(locationId: string): Promise<DedicatedPostingsResponse> {
    return apiService.get<DedicatedPostingsResponse>(
      `/business-locations/${locationId}/dedicated-postings`
    );
  }

  async createPosting(
    locationId: string,
    data: CreatePostingRequest
  ): Promise<{ success: true; posting: any }> {
    return apiService.post<{ success: true; posting: any }>(
      `/business-locations/${locationId}/dedicated-postings`,
      data
    );
  }

  async updatePosting(
    locationId: string,
    postingId: string,
    data: UpdatePostingRequest
  ): Promise<{ success: true }> {
    return apiService.request<{ success: true }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async closePosting(
    locationId: string,
    postingId: string,
    data?: ClosePostingRequest
  ): Promise<{ success: true; posting: any; autoDeclined: number }> {
    return apiService.post<{ success: true; posting: any; autoDeclined: number }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/close`,
      data
    );
  }

  async getApplications(
    locationId: string,
    postingId: string
  ): Promise<DedicatedApplicationsResponse> {
    return apiService.get<DedicatedApplicationsResponse>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications`
    );
  }

  async acceptApplication(
    locationId: string,
    postingId: string,
    applicationId: string
  ): Promise<{ success: true; application: any; posting: any }> {
    return apiService.post<{ success: true; application: any; posting: any }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/accept`
    );
  }

  async declineApplication(
    locationId: string,
    postingId: string,
    applicationId: string
  ): Promise<{ success: true }> {
    return apiService.post<{ success: true }>(
      `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/decline`
    );
  }

  async getOpportunities(): Promise<DedicatedOpportunitiesResponse> {
    return apiService.get<DedicatedOpportunitiesResponse>(
      `/agents/me/dedicated-opportunities`
    );
  }

  async getOpportunity(postingId: string): Promise<DedicatedOpportunityResponse> {
    return apiService.get<DedicatedOpportunityResponse>(
      `/agents/me/dedicated-opportunities/${postingId}`
    );
  }

  async applyToOpportunity(postingId: string): Promise<{ success: true; application: any }> {
    return apiService.post<{ success: true; application: any }>(
      `/agents/me/dedicated-opportunities/${postingId}/apply`
    );
  }

  async withdrawApplication(postingId: string): Promise<{ success: true }> {
    return apiService.post<{ success: true }>(
      `/agents/me/dedicated-opportunities/${postingId}/withdraw`
    );
  }

  async getMyAssignments(): Promise<MyDedicatedAssignmentsResponse> {
    return apiService.get<MyDedicatedAssignmentsResponse>(
      `/agents/me/dedicated-assignments`
    );
  }

  async updateOffToday(
    assignmentId: string,
    data: UpdateOffTodayRequest
  ): Promise<{ success: true }> {
    return apiService.request<{ success: true }>(
      `/agents/me/dedicated-assignments/${assignmentId}/off-today`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }
}

export default new DedicatedAgentsService();
