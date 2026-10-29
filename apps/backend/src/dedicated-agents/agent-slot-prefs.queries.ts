import type { DedicatedSlotKey } from './dedicated-agents.constants';
import { LOCK_LOCATION_FIELD } from './dedicated-assignments.queries';
import { AGENT_SLOT_PREF_COLUMNS } from './agent-slot-prefs.util';

export const AGENT_SLOT_PREFS_BY_USER_QUERY = `
  query AgentSlotPrefsByUser($userId: uuid!) {
    agents(where: { user_id: { _eq: $userId } }, limit: 1) {
      id
      user_id
      is_verified
      status
      focus
      pref_morning
      pref_afternoon
      pref_evening
    }
  }
`;

/** Live (active) dedicated assignments of the agent in the given slots, with store names for the confirm. */
export const AGENT_ACTIVE_ASSIGNMENTS_IN_SLOTS_QUERY = `
  query AgentActiveAssignmentsInSlots($agentId: uuid!, $slotKeys: [String!]!) {
    dedicated_agent_assignments(
      where: { agent_id: { _eq: $agentId }, status: { _eq: "active" }, slot_key: { _in: $slotKeys } }
      order_by: [{ slot_key: asc }, { created_at: asc }]
    ) {
      id
      slot_key
      business_location_id
      business_location {
        name
        address { country }
      }
    }
  }
`;

/**
 * One transaction: the agent row update comes first (row lock serialises concurrent
 * toggles of the same agent), then the slot-off pause of that agent's active rows.
 * The pause predicate re-reads status, so a double submit pauses nothing twice.
 */
export function saveSlotPrefsMutation(withPauses: boolean): string {
  return `
  mutation SaveAgentSlotPrefs(
    $agentId: uuid!
    $prefs: agents_set_input!
    ${withPauses ? '$offSlots: [String!]!, $pauseSet: dedicated_agent_assignments_set_input!' : ''}
  ) {
    update_agents_by_pk(pk_columns: { id: $agentId }, _set: $prefs) {
      id
      pref_morning
      pref_afternoon
      pref_evening
    }
    ${
      withPauses
        ? `paused: update_dedicated_agent_assignments(
      where: { agent_id: { _eq: $agentId }, status: { _eq: "active" }, slot_key: { _in: $offSlots } }
      _set: $pauseSet
    ) {
      returning { id agent_id slot_key source business_location_id }
    }`
        : ''
    }
  }
`;
}

/**
 * Agent Resume (AC-P5): under the location lock, and only while the row is still a
 * slot-off pause, the agent still prefers the slot, and the business has not turned
 * that store slot off. Check and write are one statement.
 */
export function resumeSlotOffMutation(slotKey: DedicatedSlotKey): string {
  const prefColumn = AGENT_SLOT_PREF_COLUMNS[slotKey];
  return `
  mutation ResumeSlotOffAssignment(
    $locationId: uuid!
    $id: uuid!
    $slotKey: String!
    $set: dedicated_agent_assignments_set_input!
  ) {
    ${LOCK_LOCATION_FIELD}
    update_dedicated_agent_assignments(
      where: {
        id: { _eq: $id }
        business_location_id: { _eq: $locationId }
        slot_key: { _eq: $slotKey }
        status: { _eq: "paused" }
        pause_reason: { _eq: "paused_slot_off" }
        agent: { ${prefColumn}: { _eq: true } }
        _not: { business_location: { pickup_slots: { slot_key: { _eq: $slotKey }, is_enabled: { _eq: false } } } }
      }
      _set: $set
    ) {
      affected_rows
      returning { id status off_today_date paused_at pause_reason removed_at }
    }
  }
`;
}
