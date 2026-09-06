import { makeAutoObservable, runInAction } from 'mobx';
import {
  NUDGE_COOLDOWN_DAYS,
  NUDGE_PERMANENT_DISMISS_AFTER,
  ONBOARDING_VERSION,
  type NudgeId,
  type OnboardingOutcome,
  type PersonaIntent,
} from '../constants/onboarding';
import { STORAGE_KEYS } from '../constants/storageKeys';
import StorageService from '../services/storage/StorageService';
import { resolveSkipTimingVariant } from '../utils/ftueExperiments';

export type NudgeRecord = {
  dismissedAt: string | null;
  shownCount: number;
  dismissCount: number;
  converted: boolean;
};

export type BrowseCounters = {
  productViews: number;
  sessionProductViews: number;
  sessions: number;
};

type PersistedFtueState = {
  completedVersion: number | null;
  completedAt: string | null;
  outcome: OnboardingOutcome | null;
  personaIntent: PersonaIntent | null;
  nudgeState: Record<string, NudgeRecord>;
  browseCounters: BrowseCounters;
};

const EMPTY_COUNTERS: BrowseCounters = {
  productViews: 0,
  sessionProductViews: 0,
  sessions: 0,
};

function emptyNudge(): NudgeRecord {
  return {
    dismissedAt: null,
    shownCount: 0,
    dismissCount: 0,
    converted: false,
  };
}

export class FtueStore {
  completedVersion: number | null = null;
  completedAt: string | null = null;
  outcome: OnboardingOutcome | null = null;
  personaIntent: PersonaIntent | null = null;
  nudgeState: Record<string, NudgeRecord> = {};
  browseCounters: BrowseCounters = { ...EMPTY_COUNTERS };
  /** Session-only: how many nudges shown this app session. */
  sessionNudgeShows = 0;
  /** A/B: when skip is visible. */
  skipTimingVariant: 'immediate' | 'after_slide_1' = 'immediate';
  hydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get shouldShowOnboarding(): boolean {
    if (!this.hydrated) return false;
    if (this.completedVersion === null) return true;
    return this.completedVersion < ONBOARDING_VERSION;
  }

  async hydrate(): Promise<void> {
    try {
      const raw = await StorageService.getObject<PersistedFtueState>(
        STORAGE_KEYS.ftue
      );
      const skipVariant = await resolveSkipTimingVariant();
      runInAction(() => {
        if (raw) {
          this.completedVersion = raw.completedVersion ?? null;
          this.completedAt = raw.completedAt ?? null;
          this.outcome = raw.outcome ?? null;
          this.personaIntent = raw.personaIntent ?? null;
          this.nudgeState = raw.nudgeState ?? {};
          this.browseCounters = {
            ...EMPTY_COUNTERS,
            ...(raw.browseCounters ?? {}),
            sessionProductViews: 0,
          };
        }
        this.skipTimingVariant = skipVariant;
        this.browseCounters.sessions += 1;
        this.hydrated = true;
      });
      await this.persist();
    } catch {
      runInAction(() => {
        this.hydrated = true;
      });
    }
  }

  private async persist(): Promise<void> {
    const payload: PersistedFtueState = {
      completedVersion: this.completedVersion,
      completedAt: this.completedAt,
      outcome: this.outcome,
      personaIntent: this.personaIntent,
      nudgeState: this.nudgeState,
      browseCounters: {
        productViews: this.browseCounters.productViews,
        sessionProductViews: this.browseCounters.sessionProductViews,
        sessions: this.browseCounters.sessions,
      },
    };
    await StorageService.setObject(STORAGE_KEYS.ftue, payload);
  }

  async completeOnboarding(
    outcome: OnboardingOutcome,
    intent: PersonaIntent | null
  ): Promise<void> {
    runInAction(() => {
      this.completedVersion = ONBOARDING_VERSION;
      this.completedAt = new Date().toISOString();
      this.outcome = outcome;
      if (intent) this.personaIntent = intent;
    });
    await this.persist();
  }

  /**
   * Mid-flow signup/login: mark complete only when onboarding was never finished.
   * Do not auto-complete version upgrades — redesigned FTUE should still show after logout.
   */
  async markCompletedIfNeeded(): Promise<void> {
    if (!this.hydrated) return;
    if (this.completedVersion !== null) return;
    await this.completeOnboarding('completed', this.personaIntent);
  }

  async setPersonaIntent(intent: PersonaIntent): Promise<void> {
    runInAction(() => {
      this.personaIntent = intent;
    });
    await this.persist();
  }

  async recordProductView(): Promise<void> {
    runInAction(() => {
      this.browseCounters.productViews += 1;
      this.browseCounters.sessionProductViews += 1;
    });
    await this.persist();
  }

  getNudge(id: NudgeId | string): NudgeRecord {
    return this.nudgeState[id] ?? emptyNudge();
  }

  isNudgeEligible(id: NudgeId | string): boolean {
    const rec = this.getNudge(id);
    if (rec.converted) return false;
    if (rec.dismissCount >= NUDGE_PERMANENT_DISMISS_AFTER) return false;
    if (rec.dismissedAt) {
      const days =
        (Date.now() - new Date(rec.dismissedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days < NUDGE_COOLDOWN_DAYS) return false;
    }
    return true;
  }

  async markNudgeShown(id: NudgeId | string): Promise<void> {
    const prev = this.getNudge(id);
    runInAction(() => {
      this.nudgeState[id] = { ...prev, shownCount: prev.shownCount + 1 };
      this.sessionNudgeShows += 1;
    });
    await this.persist();
  }

  async dismissNudge(id: NudgeId | string): Promise<void> {
    const prev = this.getNudge(id);
    runInAction(() => {
      this.nudgeState[id] = {
        ...prev,
        dismissedAt: new Date().toISOString(),
        dismissCount: prev.dismissCount + 1,
      };
    });
    await this.persist();
  }

  async convertNudge(id: NudgeId | string): Promise<void> {
    const prev = this.getNudge(id);
    runInAction(() => {
      this.nudgeState[id] = { ...prev, converted: true };
    });
    await this.persist();
  }

  async reset(): Promise<void> {
    runInAction(() => {
      this.completedVersion = null;
      this.completedAt = null;
      this.outcome = null;
      this.personaIntent = null;
      this.nudgeState = {};
      this.browseCounters = { ...EMPTY_COUNTERS };
      this.sessionNudgeShows = 0;
    });
    await StorageService.remove(STORAGE_KEYS.ftue);
  }
}
