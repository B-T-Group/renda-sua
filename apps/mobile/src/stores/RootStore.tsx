/**
 * Store racine Rendasua Agent – Auth uniquement (MobX).
 * Thème géré par ThemeContext, pas par un store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeAutoObservable } from 'mobx';
import React, { createContext, useContext } from 'react';
import { ENV_STORAGE_KEY, setRuntimeEnv } from '../config/envSwitch';
import { hydrateFirstOrderDebug } from '../config/firstOrderDebug';
import SessionService from '../services/session/SessionService';
import { AuthStore } from './AuthStore';
import { CartStore } from './CartStore';
import { MarketStore } from './MarketStore';
import { NudgeStore } from './NudgeStore';
import { FtueStore } from './FtueStore';
import { IncomingOrderStore } from './IncomingOrderStore';
import { OrderOfferStore } from './OrderOfferStore';
import { OrdersSignalStore } from './OrdersSignalStore';
import { PersonaStore } from './PersonaStore';
import { SavedAccountStore } from './SavedAccountStore';
import { StockAvailabilityStore } from './StockAvailabilityStore';
import { AdminBroadcastStore } from './AdminBroadcastStore';
import { ReferralRejectionStore } from './ReferralRejectionStore';
import { PickupReminderStore } from './PickupReminderStore';
import { StorePickupReminderStore } from './StorePickupReminderStore';
import { resetStockAvailabilityPending } from '../hooks/useStockAvailabilityChecks';
import { hydrateFirstOrderJourneyPins } from '../utils/firstOrderJourneyStorage';

export class RootStore {
  public auth: AuthStore;
  public savedAccounts: SavedAccountStore;
  public persona: PersonaStore;
  public cart: CartStore;
  public orderOffer: OrderOfferStore;
  public incomingOrder: IncomingOrderStore;
  public stockAvailability: StockAvailabilityStore;
  public adminBroadcast: AdminBroadcastStore;
  public referralRejection: ReferralRejectionStore;
  public pickupReminder: PickupReminderStore;
  public storePickupReminder: StorePickupReminderStore;
  public ordersSignal: OrdersSignalStore;
  public nudge: NudgeStore;
  public ftue: FtueStore;
  public market: MarketStore;

  constructor() {
    makeAutoObservable(this);
    this.auth = new AuthStore(this);
    this.savedAccounts = new SavedAccountStore();
    this.persona = new PersonaStore(this);
    this.cart = new CartStore();
    this.orderOffer = new OrderOfferStore(this);
    this.incomingOrder = new IncomingOrderStore(this);
    this.stockAvailability = new StockAvailabilityStore(this);
    this.adminBroadcast = new AdminBroadcastStore();
    this.referralRejection = new ReferralRejectionStore();
    this.pickupReminder = new PickupReminderStore();
    this.storePickupReminder = new StorePickupReminderStore();
    this.ordersSignal = new OrdersSignalStore();
    this.nudge = new NudgeStore();
    this.ftue = new FtueStore();
    this.market = new MarketStore();
    SessionService.bind(this);
  }

  reset(): void {
    this.orderOffer.dismiss();
    this.incomingOrder.dismiss();
    this.stockAvailability.reset();
    this.adminBroadcast.reset();
    this.referralRejection.reset();
    this.pickupReminder.reset();
    this.storePickupReminder.reset();
    resetStockAvailabilityPending();
    this.persona.reset();
    this.auth.reset();
    this.cart.clear();
  }

  async hydrate(): Promise<void> {
    try {
      const envOverride = await AsyncStorage.getItem(ENV_STORAGE_KEY);
      if (envOverride === 'dev' || envOverride === 'prod' || envOverride === 'local') {
        setRuntimeEnv(envOverride);
      }
      await hydrateFirstOrderDebug();
      await hydrateFirstOrderJourneyPins();
      await this.savedAccounts.hydrate();
      await this.auth.hydrate();
      await this.cart.hydrateFromStorage();
      await this.nudge.hydrate();
      await this.ftue.hydrate();
      await this.market.hydrate();
      if (this.auth.isAuthenticated) {
        await this.ftue.markCompletedIfNeeded();
        const { AppEventsService } = await import(
          '../services/analytics/AppEventsService'
        );
        const { FtueLifecycleService } = await import(
          '../services/ftue/FtueLifecycleService'
        );
        await FtueLifecycleService.syncFtueStateToServer(AppEventsService.track, {
          onboarding_version: this.ftue.completedVersion ?? 0,
          persona_intent: this.ftue.personaIntent,
          completed_at: this.ftue.completedAt,
        });
      }
    } catch (e) {
      console.error('Erreur lors de l\u2019hydratation:', e);
    }
  }
}

const RootStoreContext = createContext<RootStore | null>(null);

export const RootStoreProvider: React.FC<{
  store: RootStore;
  children: React.ReactNode;
}> = ({ store, children }) => (
  <RootStoreContext.Provider value={store}>{children}</RootStoreContext.Provider>
);

export function useStore(): RootStore {
  const store = useContext(RootStoreContext);
  if (!store) throw new Error('useStore must be used within RootStoreProvider');
  return store;
}
