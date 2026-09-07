import { makeAutoObservable, runInAction } from 'mobx';
import { DEFAULT_MARKET_CODE, type MarketSelectionMode } from '../types/market';
import { detectMarketLocation } from '../utils/detectMarketCountry';
import { normalizeStateCode } from '../utils/stateNormalizer';
import { fetchMarketStates } from '../services/marketStatesApi';
import {
  clearPromptDismissed,
  readPromptDismissed,
  readStoredMarket,
  writePromptDismissed,
  writeStoredMarket,
} from '../utils/marketStorage';
import { trackMarketEvent } from '../utils/marketAnalytics';

export class MarketStore {
  selectedCountryCode: string = DEFAULT_MARKET_CODE;
  /** null = browse all states in the selected country. */
  selectedStateCode: string | null = null;
  mode: MarketSelectionMode = 'AUTO';
  detectedCountryCode: string | null = null;
  detectedStateCode: string | null = null;
  pendingPromptCountry: string | null = null;
  hydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async hydrate(): Promise<void> {
    const stored = await readStoredMarket();
    if (stored) {
      runInAction(() => {
        this.selectedCountryCode = stored.countryCode;
        this.selectedStateCode = stored.stateCode ?? null;
        this.mode = stored.mode;
        this.hydrated = true;
      });
      // Detect in the background so detectedCountryCode / detectedStateCode are
      // populated for the dot indicator and switch-banner, without blocking startup.
      this.detectInBackground();
      return;
    }
    await this.initialDetect();
  }

  private detectInBackground(): void {
    detectMarketLocation()
      .then(async ({ countryCode, stateCode }) => {
        const upper = countryCode.toUpperCase();
        // Resolve the state against the backend's canonical list so abbreviations
        // (e.g. "QC") map to the full names stored in the DB (e.g. "Quebec").
        const resolvedState = await this.resolveState(upper, stateCode);
        runInAction(() => {
          this.detectedCountryCode = upper;
          this.detectedStateCode = resolvedState;
        });
      })
      .catch(() => {
        // Detection failed — leave detectedCountryCode null; no dot shown.
      });
  }

  /** Normalizes a raw geocoder state value against the backend's live states list. */
  private async resolveState(
    countryCode: string,
    rawState: string | null
  ): Promise<string | null> {
    if (!rawState) return null;
    try {
      const { states } = await fetchMarketStates(countryCode);
      const knownNames = states.map((s) => s.state);
      return normalizeStateCode(countryCode, rawState, knownNames);
    } catch {
      return rawState;
    }
  }

  async initialDetect(): Promise<void> {
    const { countryCode, stateCode } = await detectMarketLocation();
    const upper = countryCode.toUpperCase();
    const resolvedState = await this.resolveState(upper, stateCode);
    runInAction(() => {
      this.selectedCountryCode = upper;
      this.selectedStateCode = resolvedState;
      this.detectedCountryCode = upper;
      this.detectedStateCode = resolvedState;
      this.mode = 'AUTO';
      this.hydrated = true;
    });
    await writeStoredMarket({ countryCode: upper, stateCode: resolvedState, mode: 'AUTO' });
    trackMarketEvent('market_auto_detected', { countryCode: upper });
  }

  async setMarket(countryCode: string, stateCode: string | null = null): Promise<void> {
    const upper = countryCode.toUpperCase();
    const previous = this.selectedCountryCode;
    runInAction(() => {
      this.selectedCountryCode = upper;
      this.selectedStateCode = stateCode;
      this.mode = 'MANUAL';
      this.pendingPromptCountry = null;
    });
    await writeStoredMarket({ countryCode: upper, stateCode, mode: 'MANUAL' });
    await clearPromptDismissed();
    trackMarketEvent('market_changed', { countryCode: upper, previousCountryCode: previous });
  }

  async backgroundDetect(allowedCodes: string[]): Promise<void> {
    const { countryCode, stateCode } = await detectMarketLocation();
    const upper = countryCode.toUpperCase();
    const isSupported = allowedCodes.some((c) => c.toUpperCase() === upper);
    if (!isSupported) return;

    const resolvedState = await this.resolveState(upper, stateCode);

    runInAction(() => {
      this.detectedCountryCode = upper;
      this.detectedStateCode = resolvedState;
    });

    if (this.mode === 'AUTO' && upper !== this.selectedCountryCode) {
      await this.silentSwitch(upper, resolvedState);
      return;
    }

    if (this.mode === 'MANUAL' && upper !== this.selectedCountryCode) {
      const dismissed = await readPromptDismissed();
      if (dismissed?.toUpperCase() === upper) return;
      runInAction(() => { this.pendingPromptCountry = upper; });
      trackMarketEvent('market_change_prompt_shown', {
        countryCode: upper,
        previousCountryCode: this.selectedCountryCode,
      });
    }
  }

  private async silentSwitch(countryCode: string, stateCode: string | null): Promise<void> {
    const upper = countryCode.toUpperCase();
    runInAction(() => {
      this.selectedCountryCode = upper;
      this.selectedStateCode = stateCode;
    });
    await writeStoredMarket({ countryCode: upper, stateCode, mode: 'AUTO' });
    trackMarketEvent('market_auto_detected', { countryCode: upper });
  }

  async acceptPrompt(): Promise<void> {
    const target = this.pendingPromptCountry;
    if (!target) return;
    const upper = target.toUpperCase();
    // When accepting a detected-country prompt, use the detected state too.
    const stateCode = this.detectedStateCode;
    runInAction(() => {
      this.selectedCountryCode = upper;
      this.selectedStateCode = stateCode;
      this.mode = 'AUTO';
      this.pendingPromptCountry = null;
    });
    await writeStoredMarket({ countryCode: upper, stateCode, mode: 'AUTO' });
    await clearPromptDismissed();
    trackMarketEvent('market_change_prompt_accepted', { countryCode: upper });
  }

  async dismissPrompt(): Promise<void> {
    const target = this.pendingPromptCountry;
    runInAction(() => { this.pendingPromptCountry = null; });
    if (target) {
      await writePromptDismissed(target.toUpperCase());
      trackMarketEvent('market_change_prompt_dismissed', { countryCode: target.toUpperCase() });
    }
  }
}
