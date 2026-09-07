import { makeAutoObservable, runInAction } from 'mobx';
import { getEffectiveEnv } from '../config/envSwitch';
import SavedAccountService from '../services/savedAccount/SavedAccountService';
import type { SavedAccount } from '../types/savedAccount';

export class SavedAccountStore {
  accounts: SavedAccount[] = [];
  isLoading = false;
  hydrated = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get hasSavedAccounts(): boolean {
    return this.accounts.length > 0;
  }

  get shouldShowContinueAs(): boolean {
    return this.hydrated && this.hasSavedAccounts;
  }

  get sortedAccounts(): SavedAccount[] {
    return [...this.accounts].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  }

  async hydrate(): Promise<void> {
    runInAction(() => {
      this.accounts = [];
      this.isLoading = true;
    });
    try {
      const accounts = await SavedAccountService.listForEnv(getEffectiveEnv());
      runInAction(() => {
        this.accounts = accounts;
        this.hydrated = true;
        this.isLoading = false;
      });
    } catch {
      runInAction(() => {
        this.accounts = [];
        this.hydrated = true;
        this.isLoading = false;
      });
    }
  }

  reset(): void {
    this.accounts = [];
    this.isLoading = false;
    this.hydrated = false;
  }
}
