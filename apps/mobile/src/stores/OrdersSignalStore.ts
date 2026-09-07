import { makeAutoObservable } from 'mobx';

/**
 * Lightweight cross-screen signal bumped whenever an agent order status changes.
 * Global widgets (e.g. AgentStatusBar) observe `version` and refetch immediately
 * instead of waiting for the next poll / app-foreground event.
 */
export class OrdersSignalStore {
  version = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  notifyStatusChanged(): void {
    this.version += 1;
  }
}
