/**
 * Agent location writes via Nest `POST /locations/agent/me` (JWT → agent id côté serveur).
 */

import { agentApi, type UpdateMyAgentLocationApiResponse } from './agentApi';

export type UpdateMyAgentLocationResponse = UpdateMyAgentLocationApiResponse;

export async function updateMyAgentLocation(
  latitude: number,
  longitude: number
): Promise<UpdateMyAgentLocationResponse> {
  try {
    return await agentApi.locations.updateMyAgentLocation(latitude, longitude);
  } catch (e) {
    console.warn('[agentLocation] updateMyAgentLocation failed', e);
    throw e;
  }
}
