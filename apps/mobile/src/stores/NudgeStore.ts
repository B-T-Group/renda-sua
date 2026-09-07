import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable, runInAction } from 'mobx';

const STORAGE_KEY = '@RendasuaAgent:nudge:contactDismissed';

export class NudgeStore {
  contactNudgeDismissed = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      runInAction(() => {
        this.contactNudgeDismissed = raw === '1';
      });
    } catch {
      // silently ignore storage errors
    }
  }

  async dismiss(): Promise<void> {
    runInAction(() => {
      this.contactNudgeDismissed = true;
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // silently ignore storage errors
    }
  }

  async reset(): Promise<void> {
    runInAction(() => {
      this.contactNudgeDismissed = false;
    });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore storage errors
    }
  }
}
