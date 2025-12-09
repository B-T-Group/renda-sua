/**
 * Application feature flags
 * These flags control the visibility/availability of features across the application
 */

export const APP_FEATURES = {
  /**
   * Enable/disable the "Mark as In Transit" action for agents
   * Set to false to temporarily hide this action
   */
  AGENT_MARK_AS_IN_TRANSIT: false,
} as const;
