import { useCallback, useMemo } from 'react';
import { useApiClient } from './useApiClient';
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
  AdminAssignmentsResponse,
  AdminAgentPickerResponse,
  AdminLocationsResponse,
  CreateAssignmentRequest,
  DedicatedAgentsCapabilityResponse,
  AdminCapabilityResponse,
} from '../types/dedicatedAgents';

export const useDedicatedAgents = () => {
  const apiClient = useApiClient();

  const getCapability = useCallback(
    async (country?: string): Promise<DedicatedAgentsCapabilityResponse> => {
      const url = country
        ? `/dedicated-agents/capability?country=${country}`
        : `/agents/me/dedicated-agents/capability`;
      const response = await apiClient.get<DedicatedAgentsCapabilityResponse>(url);
      return response.data;
    },
    [apiClient]
  );

  const getAdminCapability = useCallback(
    async (): Promise<AdminCapabilityResponse> => {
      const response = await apiClient.get<AdminCapabilityResponse>(
        `/admin/dedicated-agents/capability`
      );
      return response.data;
    },
    [apiClient]
  );

  const getPickupSlots = useCallback(
    async (locationId: string): Promise<PickupSlotsResponse> => {
      const response = await apiClient.get<PickupSlotsResponse>(
        `/business-locations/${locationId}/pickup-slots`
      );
      return response.data;
    },
    [apiClient]
  );

  const updatePickupSlots = useCallback(
    async (locationId: string, data: UpdatePickupSlotsRequest): Promise<PickupSlotsResponse> => {
      const response = await apiClient.patch<PickupSlotsResponse>(
        `/business-locations/${locationId}/pickup-slots`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const getDedicatedAgents = useCallback(
    async (locationId: string): Promise<DedicatedAgentsResponse> => {
      const response = await apiClient.get<DedicatedAgentsResponse>(
        `/business-locations/${locationId}/dedicated-agents`
      );
      return response.data;
    },
    [apiClient]
  );

  const updateAssignment = useCallback(
    async (
      locationId: string,
      assignmentId: string,
      data: UpdateAssignmentRequest
    ): Promise<{ success: true }> => {
      const response = await apiClient.patch<{ success: true }>(
        `/business-locations/${locationId}/dedicated-agents/${assignmentId}`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const deleteAssignment = useCallback(
    async (
      locationId: string,
      assignmentId: string,
      data?: DeleteAssignmentRequest
    ): Promise<{ success: true }> => {
      const response = await apiClient.delete<{ success: true }>(
        `/business-locations/${locationId}/dedicated-agents/${assignmentId}`,
        { data }
      );
      return response.data;
    },
    [apiClient]
  );

  const getPostings = useCallback(
    async (locationId: string): Promise<DedicatedPostingsResponse> => {
      const response = await apiClient.get<DedicatedPostingsResponse>(
        `/business-locations/${locationId}/dedicated-postings`
      );
      return response.data;
    },
    [apiClient]
  );

  const createPosting = useCallback(
    async (
      locationId: string,
      data: CreatePostingRequest
    ): Promise<{ success: true; posting: any }> => {
      const response = await apiClient.post<{ success: true; posting: any }>(
        `/business-locations/${locationId}/dedicated-postings`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const updatePosting = useCallback(
    async (
      locationId: string,
      postingId: string,
      data: UpdatePostingRequest
    ): Promise<{ success: true }> => {
      const response = await apiClient.patch<{ success: true }>(
        `/business-locations/${locationId}/dedicated-postings/${postingId}`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const closePosting = useCallback(
    async (
      locationId: string,
      postingId: string,
      data?: ClosePostingRequest
    ): Promise<{ success: true; posting: any; autoDeclined: number }> => {
      const response = await apiClient.post<{ success: true; posting: any; autoDeclined: number }>(
        `/business-locations/${locationId}/dedicated-postings/${postingId}/close`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const getApplications = useCallback(
    async (locationId: string, postingId: string): Promise<DedicatedApplicationsResponse> => {
      const response = await apiClient.get<DedicatedApplicationsResponse>(
        `/business-locations/${locationId}/dedicated-postings/${postingId}/applications`
      );
      return response.data;
    },
    [apiClient]
  );

  const acceptApplication = useCallback(
    async (
      locationId: string,
      postingId: string,
      applicationId: string
    ): Promise<{ success: true; application: any; posting: any }> => {
      const response = await apiClient.post<{ success: true; application: any; posting: any }>(
        `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/accept`
      );
      return response.data;
    },
    [apiClient]
  );

  const declineApplication = useCallback(
    async (
      locationId: string,
      postingId: string,
      applicationId: string
    ): Promise<{ success: true }> => {
      const response = await apiClient.post<{ success: true }>(
        `/business-locations/${locationId}/dedicated-postings/${postingId}/applications/${applicationId}/decline`
      );
      return response.data;
    },
    [apiClient]
  );

  const getAdminAssignments = useCallback(
    async (filters?: {
      city?: string;
      locationId?: string;
      slotKey?: string;
      status?: string;
      source?: string;
    }): Promise<AdminAssignmentsResponse> => {
      const params = new URLSearchParams();
      if (filters?.city) params.append('city', filters.city);
      if (filters?.locationId) params.append('locationId', filters.locationId);
      if (filters?.slotKey) params.append('slotKey', filters.slotKey);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.source) params.append('source', filters.source);
      
      const query = params.toString();
      const url = `/admin/dedicated-agents${query ? `?${query}` : ''}`;
      const response = await apiClient.get<AdminAssignmentsResponse>(url);
      return response.data;
    },
    [apiClient]
  );

  const getAdminAgentPicker = useCallback(
    async (locationId: string): Promise<AdminAgentPickerResponse> => {
      const response = await apiClient.get<AdminAgentPickerResponse>(
        `/admin/dedicated-agents/picker?locationId=${locationId}`
      );
      return response.data;
    },
    [apiClient]
  );

  const getAdminLocations = useCallback(
    async (query: string, city?: string, limit?: number): Promise<AdminLocationsResponse> => {
      const params = new URLSearchParams({ q: query });
      if (city) params.append('city', city);
      if (limit) params.append('limit', limit.toString());
      
      const response = await apiClient.get<AdminLocationsResponse>(
        `/admin/dedicated-agents/locations?${params.toString()}`
      );
      return response.data;
    },
    [apiClient]
  );

  const getAdminLocationSlots = useCallback(
    async (locationId: string): Promise<PickupSlotsResponse> => {
      const response = await apiClient.get<PickupSlotsResponse>(
        `/admin/dedicated-agents/locations/${locationId}/pickup-slots`
      );
      return response.data;
    },
    [apiClient]
  );

  const createAdminAssignment = useCallback(
    async (data: CreateAssignmentRequest): Promise<{ success: true; assignments: any[] }> => {
      const response = await apiClient.post<{ success: true; assignments: any[] }>(
        `/admin/dedicated-agents/assignments`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const updateAdminAssignment = useCallback(
    async (
      assignmentId: string,
      data: UpdateAssignmentRequest
    ): Promise<{ success: true }> => {
      const response = await apiClient.patch<{ success: true }>(
        `/admin/dedicated-agents/assignments/${assignmentId}`,
        data
      );
      return response.data;
    },
    [apiClient]
  );

  const deleteAdminAssignment = useCallback(
    async (assignmentId: string): Promise<{ success: true }> => {
      const response = await apiClient.delete<{ success: true }>(
        `/admin/dedicated-agents/assignments/${assignmentId}`
      );
      return response.data;
    },
    [apiClient]
  );

  return useMemo(
    () => ({
        getCapability,
        getAdminCapability,
        getPickupSlots,
        updatePickupSlots,
        getDedicatedAgents,
        updateAssignment,
        deleteAssignment,
        getPostings,
        createPosting,
        updatePosting,
        closePosting,
        getApplications,
        acceptApplication,
        declineApplication,
        getAdminAssignments,
        getAdminAgentPicker,
        getAdminLocations,
        getAdminLocationSlots,
        createAdminAssignment,
        updateAdminAssignment,
        deleteAdminAssignment,
    }),
    [
      getCapability,
      getAdminCapability,
      getPickupSlots,
      updatePickupSlots,
      getDedicatedAgents,
      updateAssignment,
      deleteAssignment,
      getPostings,
      createPosting,
      updatePosting,
      closePosting,
      getApplications,
      acceptApplication,
      declineApplication,
      getAdminAssignments,
      getAdminAgentPicker,
      getAdminLocations,
      getAdminLocationSlots,
      createAdminAssignment,
      updateAdminAssignment,
      deleteAdminAssignment,
    ]
  );
};
