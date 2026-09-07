/** Background location task name — must match TaskManager.defineTask and start/stop calls. */
export const AGENT_LOCATION_TASK_NAME = 'rendasua-agent-location-updates';

/** Last coordinates successfully sent to Hasura (JSON: { lat, lng }) for task + hook deduplication. */
export const AGENT_LOCATION_LAST_SENT_KEY = '@RendasuaAgent:lastAgentLocationSentCoords';

/**
 * Set to `'1'` while background location updates are enabled from the hook.
 * Headless task exits early if absent (persona switch / logout).
 */
export const AGENT_LOCATION_BG_ACTIVE_KEY = '@RendasuaAgent:agentLocationBackgroundActive';

/** `'1'` while background tracking uses active-delivery cadence (50m). */
export const AGENT_LOCATION_BG_ACTIVE_DELIVERY_KEY =
  '@RendasuaAgent:agentLocationBackgroundActiveDelivery';

/** Mirror AuthStore keys for headless task reads. */
export const AUTH_STORAGE_USER_KEY = '@RendasuaAgent:user';
export const AUTH_STORAGE_IS_AUTHENTICATED_KEY = '@RendasuaAgent:isAuthenticated';
