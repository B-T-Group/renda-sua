import { makeAutoObservable, runInAction } from 'mobx';
import type { RootStore } from './RootStore';
import { agentApi, type AddPersonaBody } from '../services/agentApi';
import type { PersonaSlug } from '../types/persona';
import type { ActiveContext, DelegationGrant } from '../types/delegation';
import {
  clearActivePersonaStorage,
  readStoredContext,
  writeHasuraUserId,
  writeStoredContext,
  writeStoredPersona,
} from '../utils/activePersonaStorage';
import { derivePersonasFromMeUser, supportedAppPersonas } from '../utils/personaFromMe';
import Auth0DirectService from '../services/auth0DirectService';

export class PersonaStore {
  private root: RootStore;
  loadState: 'idle' | 'loading' | 'ready' = 'idle';
  private _sessionInFlight = false;
  needsPersonaSelection = false;
  /** Last persona committed for this session (order detail and other persona-specific UI). */
  activePersona: PersonaSlug = 'agent';
  /** Persona or location-delegation session context. */
  activeContext: ActiveContext | null = null;
  noSupportedPersonaAccess = false;
  personas: PersonaSlug[] = [];
  delegations: DelegationGrant[] = [];
  hasuraUserId: string | null = null;
  loadError: string | null = null;
  pickingPersona: PersonaSlug | null = null;
  pickingDelegationId: string | null = null;
  enrollingPersona: PersonaSlug | null = null;
  private lastHydratedAuthSub: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { _sessionInFlight: false });
  }

  get isDelegationContext(): boolean {
    return this.activeContext?.kind === 'delegation';
  }

  get activeDelegation(): DelegationGrant | null {
    if (this.activeContext?.kind !== 'delegation') return null;
    return this.delegations.find((d) => d.id === this.activeContext!.delegationId) ?? null;
  }

  get showPersonaLoading(): boolean {
    return this.root.auth.isAuthenticated && this.loadState === 'loading';
  }

  get showPersonaError(): boolean {
    return this.root.auth.isAuthenticated && this.loadState === 'ready' && !!this.loadError;
  }

  get showPersonaPicker(): boolean {
    return (
      this.root.auth.isAuthenticated &&
      this.loadState === 'ready' &&
      !this.loadError &&
      this.needsPersonaSelection
    );
  }

  get showNoAgent(): boolean {
    return this.showNoSupportedPersona;
  }

  get showNoSupportedPersona(): boolean {
    return (
      this.root.auth.isAuthenticated &&
      this.loadState === 'ready' &&
      !this.loadError &&
      this.noSupportedPersonaAccess
    );
  }

  get showMainApp(): boolean {
    return (
      this.root.auth.isAuthenticated &&
      this.loadState === 'ready' &&
      !this.loadError &&
      !this.needsPersonaSelection &&
      !this.noSupportedPersonaAccess &&
      !!this.activeContext
    );
  }

  reset(): void {
    this._sessionInFlight = false;
    this.loadState = 'idle';
    this.needsPersonaSelection = false;
    this.activePersona = 'agent';
    this.activeContext = null;
    this.noSupportedPersonaAccess = false;
    this.personas = [];
    this.delegations = [];
    this.hasuraUserId = null;
    this.loadError = null;
    this.pickingPersona = null;
    this.pickingDelegationId = null;
    this.enrollingPersona = null;
    this.lastHydratedAuthSub = null;
    void clearActivePersonaStorage();
  }

  async ensureSession(): Promise<void> {
    if (!this.root.auth.isAuthenticated) {
      this.reset();
      return;
    }
    const authSub = this.root.auth.user?.id ?? null;
    if (!authSub) return;
    if (this._sessionInFlight) return;
    if (
      this.loadState === 'ready' &&
      !this.loadError &&
      this.lastHydratedAuthSub === authSub &&
      this.hasuraUserId &&
      this.activeContext
    ) {
      return;
    }

    this._sessionInFlight = true;
    runInAction(() => {
      this.loadState = 'loading';
      this.loadError = null;
    });

    try {
      const me = await agentApi.users.getMe();
      if (!me.success || !me.user?.id) {
        throw new Error(me.message ?? 'Unable to load profile');
      }
      const user = me.user;
      const personas = supportedAppPersonas(derivePersonasFromMeUser(user));
      const delegations = me.delegations ?? user.delegations ?? [];
      await writeHasuraUserId(user.id);

      if (personas.length === 0 && delegations.length === 0) {
        runInAction(() => {
          this.hasuraUserId = user.id;
          this.personas = personas;
          this.delegations = [];
          this.noSupportedPersonaAccess = true;
          this.needsPersonaSelection = false;
          this.activeContext = null;
          this.loadState = 'ready';
          this.lastHydratedAuthSub = authSub;
        });
        return;
      }

      runInAction(() => {
        this.hasuraUserId = user.id;
        this.personas = personas;
        this.delegations = delegations;
        this.noSupportedPersonaAccess = false;
      });

      const resumeCheckoutId = this.root.auth.postAuthResumeInventoryItemId?.trim();
      const resumeDetailId = this.root.auth.postAuthResumeInventoryDetailId?.trim();
      const resumeCartCheckout = this.root.auth.postAuthResumeCartCheckout;
      if (
        (resumeCheckoutId || resumeDetailId || resumeCartCheckout) &&
        personas.includes('client')
      ) {
        await this.commitPersona('client');
        runInAction(() => {
          this.applyResolvedPersona('client');
          this.lastHydratedAuthSub = authSub;
        });
        return;
      }

      const totalContexts = personas.length + delegations.length;
      if (totalContexts === 1) {
        if (personas.length === 1) {
          await this.commitPersona(personas[0]);
          runInAction(() => {
            this.applyResolvedPersona(personas[0]);
            this.lastHydratedAuthSub = authSub;
          });
          return;
        }
        await this.commitDelegation(delegations[0].id);
        runInAction(() => {
          this.applyResolvedDelegation(delegations[0].id);
          this.lastHydratedAuthSub = authSub;
        });
        return;
      }

      const stored = await readStoredContext();
      if (stored?.userId === user.id) {
        if (
          stored.kind === 'persona' &&
          stored.persona &&
          personas.includes(stored.persona)
        ) {
          await this.commitPersona(stored.persona);
          runInAction(() => {
            this.applyResolvedPersona(stored.persona);
            this.lastHydratedAuthSub = authSub;
          });
          return;
        }
        if (
          stored.kind === 'delegation' &&
          delegations.some((d) => d.id === stored.delegationId)
        ) {
          await this.commitDelegation(stored.delegationId);
          runInAction(() => {
            this.applyResolvedDelegation(stored.delegationId);
            this.lastHydratedAuthSub = authSub;
          });
          return;
        }
      }

      runInAction(() => {
        this.needsPersonaSelection = true;
        this.activeContext = null;
        this.loadState = 'ready';
        this.lastHydratedAuthSub = authSub;
      });
    } catch (e: any) {
      runInAction(() => {
        this.loadError = e instanceof Error ? e.message : 'UNKNOWN';
        this.loadState = 'ready';
      });
    } finally {
      this._sessionInFlight = false;
    }
  }

  async retryAfterError(): Promise<void> {
    runInAction(() => {
      this.loadError = null;
      this.loadState = 'idle';
      this.lastHydratedAuthSub = null;
    });
    await this.ensureSession();
  }

  async selectPersona(p: PersonaSlug): Promise<void> {
    if (!this.personas.includes(p)) return;
    runInAction(() => {
      this.pickingPersona = p;
      this.pickingDelegationId = null;
    });
    try {
      await this.commitPersona(p);
      runInAction(() => this.applyResolvedPersona(p));
    } finally {
      runInAction(() => {
        this.pickingPersona = null;
      });
    }
  }

  async selectDelegation(delegationId: string): Promise<void> {
    if (!this.delegations.some((d) => d.id === delegationId)) return;
    runInAction(() => {
      this.pickingDelegationId = delegationId;
      this.pickingPersona = null;
    });
    try {
      await this.commitDelegation(delegationId);
      runInAction(() => this.applyResolvedDelegation(delegationId));
    } finally {
      runInAction(() => {
        this.pickingDelegationId = null;
      });
    }
  }

  /** Switch to the grant matching a location id (push / deep link). */
  async selectDelegationForLocation(locationId: string): Promise<boolean> {
    const match = this.delegations.find((d) => d.locationId === locationId);
    if (!match) return false;
    if (
      this.activeContext?.kind === 'delegation' &&
      this.activeContext.delegationId === match.id
    ) {
      return true;
    }
    await this.selectDelegation(match.id);
    return true;
  }

  async enrollPersona(persona: PersonaSlug, body: AddPersonaBody = {}): Promise<void> {
    runInAction(() => {
      this.enrollingPersona = persona;
    });
    try {
      const res = await agentApi.users.addPersona(persona, body);
      if (res.success === false) {
        throw new Error(res.error || 'Failed to add persona');
      }
      await this.refreshPersonasFromServer();
    } finally {
      runInAction(() => {
        this.enrollingPersona = null;
      });
    }
  }

  async refreshPersonasFromServer(): Promise<void> {
    const me = await agentApi.users.getMe();
    if (!me.success || !me.user) {
      throw new Error(me.message ?? 'Unable to refresh profile');
    }
    runInAction(() => {
      this.personas = supportedAppPersonas(derivePersonasFromMeUser(me.user!));
      this.delegations = me.delegations ?? me.user!.delegations ?? [];
      this.lastHydratedAuthSub = null;
    });
  }

  private applyResolvedPersona(p: PersonaSlug): void {
    this.needsPersonaSelection = false;
    this.activePersona = p;
    this.activeContext = { kind: 'persona', persona: p };
    this.loadState = 'ready';
  }

  private applyResolvedDelegation(delegationId: string): void {
    this.needsPersonaSelection = false;
    this.activeContext = { kind: 'delegation', delegationId };
    this.loadState = 'ready';
  }

  private async commitPersona(persona: PersonaSlug): Promise<void> {
    const uid = this.hasuraUserId;
    if (!uid) return;
    try {
      await agentApi.users.setActiveContext({ kind: 'persona', persona });
    } catch {
      await agentApi.users.setActivePersona(persona);
    }
    await writeStoredPersona(uid, persona);
    await Auth0DirectService.refreshAccessToken({ active_persona: persona });
  }

  private async commitDelegation(delegationId: string): Promise<void> {
    const uid = this.hasuraUserId;
    if (!uid) return;
    await agentApi.users.setActiveContext({ kind: 'delegation', delegationId });
    await writeStoredContext({ userId: uid, kind: 'delegation', delegationId });
    // Delegation mode: refresh without active_persona so Auth0 defaults to `user`.
    await Auth0DirectService.refreshAccessToken();
  }
}
