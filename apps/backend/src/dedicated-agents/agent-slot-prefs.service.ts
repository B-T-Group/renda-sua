import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AgentContractGateService } from '../agent-contracts/agent-contract-gate.service';
import { showsDeliveryChrome } from '../agents/agent-focus.util';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { emitServerSiteEvent } from '../site-events/server-site-events.helper';
import { SiteEventsService } from '../site-events/site-events.service';
import {
  AGENT_ACTIVE_ASSIGNMENTS_IN_SLOTS_QUERY,
  AGENT_SLOT_PREFS_BY_USER_QUERY,
  resumeSlotOffMutation,
  saveSlotPrefsMutation,
} from './agent-slot-prefs.queries';
import {
  AGENT_SLOT_PREF_COLUMNS,
  isScheduledBlind,
  slotPrefsFromRow,
  type AgentSlotPrefRow,
  type AgentSlotPrefs,
} from './agent-slot-prefs.util';
import { DedicatedAgentsConfigService } from './dedicated-agents-config.service';
import { DEDICATED_SLOT_KEYS, type DedicatedSlotKey } from './dedicated-agents.constants';
import { runAssignmentWrite } from './dedicated-assignment-write.util';
import { DEDICATED_ASSIGNMENT_BY_ID_QUERY } from './dedicated-assignments.queries';
import { DedicatedAssignmentsService, type AssignmentRow } from './dedicated-assignments.service';

interface AgentPrefsRow extends AgentSlotPrefRow {
  id: string;
  user_id: string;
  is_verified: boolean | null;
  status: string | null;
  focus: string | null;
}

interface ActiveSlotAssignment {
  id: string;
  slot_key: DedicatedSlotKey;
  business_location_id: string;
  business_location: { name: string | null; address: { country: string | null } | null } | null;
}

export interface SlotPrefsUpdateInput {
  morning?: unknown;
  afternoon?: unknown;
  evening?: unknown;
  /** AC-P3/P4: the client re-sends with true after the agent confirmed "Turn off and pause". */
  confirmPause?: unknown;
}

export interface SlotOffConflictStore {
  assignmentId: string;
  locationId: string;
  storeName: string;
  slotKey: DedicatedSlotKey;
}

/** Why an agent can't resume (AC-P5 re-check of v5 D5 profile rules). */
export type ResumeRefusal =
  | 'slot_pref_off'
  | 'store_slot_off'
  | 'not_slot_off_pause'
  | 'not_verified'
  | 'contract_unsigned'
  | 'suspended'
  | 'commercial_focus';

/**
 * #594 addendum PR1: agent preferred delivery slots (AC-P1..P6).
 * Writes are Nest-only; the agent reads its own prefs through Hasura select too.
 */
@Injectable()
export class AgentSlotPrefsService {
  constructor(
    private readonly hasuraSystemService: HasuraSystemService,
    private readonly configService: DedicatedAgentsConfigService,
    private readonly assignments: DedicatedAssignmentsService,
    @Optional() private readonly contractGate?: AgentContractGateService,
    @Optional() private readonly siteEventsService?: SiteEventsService
  ) {}

  async get(userId: string): Promise<{ preferences: AgentSlotPrefs; allOff: boolean }> {
    const agent = await this.requireAgent(userId);
    const preferences = slotPrefsFromRow(agent);
    return { preferences, allOff: isScheduledBlind(preferences) };
  }

  /**
   * Instant per-toggle save (P8). ON never confirms (AC-P3). OFF on a slot with
   * ≥1 active dedicated assignment needs `confirmPause: true`; without it nothing
   * is written and a 409 `slot_has_dedicated_assignments` lists the stores, so
   * "Keep on" (no second call) leaves the toggle ON (AC-P4). Idempotent.
   */
  async update(userId: string, input: SlotPrefsUpdateInput) {
    const changes = parseChanges(input);
    const confirmPause = input?.confirmPause === true;
    const agent = await this.requireAgent(userId);
    const before = slotPrefsFromRow(agent);
    const after: AgentSlotPrefs = { ...before, ...changes };
    const turningOff = DEDICATED_SLOT_KEYS.filter((k) => before[k] && !after[k]);
    const turningOn = DEDICATED_SLOT_KEYS.filter((k) => !before[k] && after[k]);
    if (turningOff.length === 0 && turningOn.length === 0) {
      return { preferences: before, allOff: isScheduledBlind(before), pausedAssignmentIds: [] as string[] };
    }

    const affected = turningOff.length > 0 ? await this.activeAssignmentsIn(agent.id, turningOff) : [];
    if (affected.length > 0 && !confirmPause) {
      throw new ConflictException({
        code: 'slot_has_dedicated_assignments',
        message: 'Turning off this slot pauses your dedicated assignments',
        slots: [...new Set(affected.map((a) => a.slot_key))],
        stores: affected.map(
          (a): SlotOffConflictStore => ({
            assignmentId: a.id,
            locationId: a.business_location_id,
            storeName: a.business_location?.name ?? '',
            slotKey: a.slot_key,
          })
        ),
      });
    }

    const prefs: Record<string, boolean> = {};
    for (const k of [...turningOff, ...turningOn]) prefs[AGENT_SLOT_PREF_COLUMNS[k]] = after[k];
    const withPauses = turningOff.length > 0;
    const res = await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation<{
        update_agents_by_pk: AgentSlotPrefRow | null;
        paused?: {
          returning: Array<{
            id: string;
            agent_id: string;
            slot_key: DedicatedSlotKey;
            source: string;
            business_location_id: string;
          }>;
        };
      }>(
        saveSlotPrefsMutation(withPauses),
        withPauses
          ? {
              agentId: agent.id,
              prefs,
              offSlots: turningOff,
              pauseSet: {
                status: 'paused',
                paused_at: new Date().toISOString(),
                paused_by_user_id: userId,
                pause_reason: 'paused_slot_off',
              },
            }
          : { agentId: agent.id, prefs }
      )
    );
    const saved = slotPrefsFromRow(res?.update_agents_by_pk ?? (after as unknown as AgentSlotPrefRow));
    const paused = res?.paused?.returning ?? [];

    this.assignments.statusChanged(paused, 'active', 'paused', 'agent_slot_off');
    for (const p of paused) {
      emitServerSiteEvent(this.siteEventsService, 'pref_slot.assignment_paused', {
        assignmentId: p.id,
        agentId: agent.id,
        businessLocationId: p.business_location_id,
        slotKey: p.slot_key,
      });
    }
    for (const k of turningOff) {
      emitServerSiteEvent(this.siteEventsService, 'pref_slot.toggled', {
        agentId: agent.id,
        slot: k,
        on: false,
        had_assignment: paused.some((p) => p.slot_key === k),
      });
    }
    for (const k of turningOn) {
      emitServerSiteEvent(this.siteEventsService, 'pref_slot.toggled', {
        agentId: agent.id,
        slot: k,
        on: true,
        had_assignment: false,
      });
    }
    const allOff = isScheduledBlind(saved);
    if (allOff !== isScheduledBlind(before)) {
      emitServerSiteEvent(this.siteEventsService, 'pref_slot.all_off_state', { agentId: agent.id, allOff });
    }
    return { preferences: saved, allOff, pausedAssignmentIds: paused.map((p) => p.id) };
  }

  /**
   * AC-P5 Resume: only a `paused_slot_off` row, only while the slot pref is ON
   * (no auto-resume, P5), re-checking v5 D5 profile rules (verified, contract,
   * not suspended, delivery focus). Off today, capacity and balance are per-order
   * and stay with dispatch. Idempotent on an already active row.
   */
  async resume(userId: string, assignmentId: string) {
    const agent = await this.requireAgent(userId);
    const row = await this.loadAssignment(assignmentId);
    if (!row || row.agent_id !== agent.id) throw new NotFoundException('Assignment not found');
    const country = row.business_location?.address?.country?.trim().toUpperCase();
    if (!country || !(await this.configService.getConfig(country)).enabled) {
      throw new NotFoundException('Not found');
    }
    if (row.status === 'removed') {
      throw new ConflictException({ code: 'assignment_removed', message: 'This assignment was removed' });
    }
    if (row.status === 'active') return { assignment: { id: row.id, status: 'active', pause_reason: null } };

    const refusal = await this.resumeRefusal(agent, row);
    if (refusal) throw new ConflictException({ code: refusal, message: RESUME_MESSAGES[refusal], slotKey: row.slot_key });

    const res = await runAssignmentWrite(() =>
      this.hasuraSystemService.executeMutation<{
        update_dedicated_agent_assignments: { affected_rows: number; returning: Array<Record<string, unknown>> };
      }>(resumeSlotOffMutation(row.slot_key), {
        locationId: row.business_location_id,
        id: row.id,
        slotKey: row.slot_key,
        set: { status: 'active', paused_at: null, paused_by_user_id: null, pause_reason: null },
      })
    );
    const out = res?.update_dedicated_agent_assignments;
    if (!out || out.affected_rows === 0) {
      throw new ConflictException({
        code: 'assignment_changed',
        message: 'This assignment or the store slot changed; reload and retry',
      });
    }
    this.assignments.statusChanged([row], 'paused', 'active', 'agent_resume');
    emitServerSiteEvent(this.siteEventsService, 'pref_slot.assignment_resumed', {
      assignmentId: row.id,
      agentId: agent.id,
      businessLocationId: row.business_location_id,
      slotKey: row.slot_key,
    });
    return { assignment: out.returning[0] };
  }

  // ---------------------------------------------------------------- internals

  private async resumeRefusal(agent: AgentPrefsRow, row: AssignmentRow): Promise<ResumeRefusal | null> {
    if (row.pause_reason !== 'paused_slot_off') return 'not_slot_off_pause';
    if (!slotPrefsFromRow(agent)[row.slot_key]) return 'slot_pref_off';
    // Friendly refusal; the resume mutation's own predicate stays the guard.
    if ((await this.assignments.disabledSlots(row.business_location_id)).has(row.slot_key)) return 'store_slot_off';
    if (agent.is_verified !== true) return 'not_verified';
    if (agent.status === 'suspended') return 'suspended';
    if (!showsDeliveryChrome(agent.focus)) return 'commercial_focus';
    if (this.contractGate && !(await this.contractGate.canOperate(agent.id))) return 'contract_unsigned';
    return null;
  }

  private async requireAgent(userId: string): Promise<AgentPrefsRow> {
    const res = await this.hasuraSystemService.executeQuery<{ agents: AgentPrefsRow[] }>(
      AGENT_SLOT_PREFS_BY_USER_QUERY,
      { userId }
    );
    const agent = res?.agents?.[0];
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  private async activeAssignmentsIn(agentId: string, slotKeys: DedicatedSlotKey[]): Promise<ActiveSlotAssignment[]> {
    const res = await this.hasuraSystemService.executeQuery<{ dedicated_agent_assignments: ActiveSlotAssignment[] }>(
      AGENT_ACTIVE_ASSIGNMENTS_IN_SLOTS_QUERY,
      { agentId, slotKeys }
    );
    return res?.dedicated_agent_assignments ?? [];
  }

  private async loadAssignment(id: string): Promise<AssignmentRow | null> {
    const res = await this.hasuraSystemService.executeQuery<{
      dedicated_agent_assignments_by_pk: AssignmentRow | null;
    }>(DEDICATED_ASSIGNMENT_BY_ID_QUERY, { id });
    return res?.dedicated_agent_assignments_by_pk ?? null;
  }
}

const RESUME_MESSAGES: Record<ResumeRefusal, string> = {
  slot_pref_off: 'Turn this slot back on before resuming',
  store_slot_off: 'The store has turned this slot off',
  not_slot_off_pause: 'This assignment was paused by the store or RendaSua',
  not_verified: 'Your account must be verified to resume',
  contract_unsigned: 'Sign the agent contract to resume',
  suspended: 'Your account is suspended',
  commercial_focus: 'Switch to delivery focus to resume',
};

/** Body -> per-slot booleans. Unknown keys ignored; a present non-boolean is a 400; at least one slot required. */
export function parseChanges(input: SlotPrefsUpdateInput | null | undefined): Partial<AgentSlotPrefs> {
  const out: Partial<AgentSlotPrefs> = {};
  for (const k of DEDICATED_SLOT_KEYS) {
    const v = input?.[k];
    if (v === undefined) continue;
    if (typeof v !== 'boolean') {
      throw new BadRequestException({ code: 'invalid_slot_pref', message: `${k} must be a boolean` });
    }
    out[k] = v;
  }
  if (Object.keys(out).length === 0) {
    throw new BadRequestException({
      code: 'invalid_slot_pref',
      message: `Send at least one of ${DEDICATED_SLOT_KEYS.join(', ')}`,
    });
  }
  return out;
}
