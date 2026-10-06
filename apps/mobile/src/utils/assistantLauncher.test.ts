import { describe, expect, it } from 'vitest';
import {
  ATTENTION_IDLE_MS,
  ATTENTION_WINDOW_MS,
  assistantViewer,
  attentionDelay,
  canPlayAttention,
  canSeeRendaCharacter,
  canShowNudge,
  cartFabVisibleOn,
  isLauncherRoute,
  isSettled,
  launcherPlacement,
  NUDGE_STORAGE_KEY,
  parseAttentionHistory,
  recordAttention,
  SETTLE_AFTER_MS,
  shouldHideHeaderAssistantButton,
  shouldShowLauncher,
  type LauncherVisibilityInput,
} from './assistantLauncher';
import { DEFAULT_CLIENT_FLAGS } from '../services/clientFlagsApi';

const visible: LauncherVisibilityInput = {
  flagOn: true,
  viewer: 'client',
  route: 'ClientBrowse',
  mounted: true,
  keyboardOpen: false,
  suppressed: false,
  ftueShowing: false,
  marketPromptShowing: false,
};

describe('viewer / persona gating', () => {
  it('maps auth + persona to a viewer', () => {
    expect(assistantViewer(false, 'agent')).toBe('guest');
    expect(assistantViewer(true, 'client')).toBe('client');
    expect(assistantViewer(true, 'business')).toBe('business');
    expect(assistantViewer(true, 'agent')).toBe('agent');
    expect(assistantViewer(true, null)).toBe('agent');
  });

  it('only client and guest see the character', () => {
    expect(canSeeRendaCharacter('client')).toBe(true);
    expect(canSeeRendaCharacter('guest')).toBe(true);
    expect(canSeeRendaCharacter('agent')).toBe(false);
    expect(canSeeRendaCharacter('business')).toBe(false);
  });
});

describe('flag gating + allowlist', () => {
  it('the launcher flag defaults to off', () => {
    expect(DEFAULT_CLIENT_FLAGS.assistant_launcher_v1).toBe(false);
  });

  it('shows only with the flag on, after the deferred mount', () => {
    expect(shouldShowLauncher(visible)).toBe(true);
    expect(shouldShowLauncher({ ...visible, flagOn: false })).toBe(false);
    expect(shouldShowLauncher({ ...visible, mounted: false })).toBe(false);
  });

  it('never shows for agent / business', () => {
    expect(shouldShowLauncher({ ...visible, viewer: 'agent' })).toBe(false);
    expect(shouldShowLauncher({ ...visible, viewer: 'business' })).toBe(false);
  });

  it('uses the per-persona allowlist', () => {
    for (const r of ['ClientBrowse', 'ClientSearch', 'ClientOrders', 'ClientMenu', 'CategoriesBrowse', 'CollectionDetail', 'StoresList', 'StoreDetail', 'OrderDetail']) {
      expect(isLauncherRoute('client', r)).toBe(true);
    }
    for (const r of ['GuestBrowse', 'GuestFoods', 'GuestRentals', 'StoreDetail', 'StoresList']) {
      expect(isLauncherRoute('guest', r)).toBe(true);
    }
    expect(isLauncherRoute('guest', 'ClientBrowse')).toBe(false);
    expect(isLauncherRoute('guest', 'OrderDetail')).toBe(false);
  });

  it('is hidden on checkout, auth, chat, item detail and reels', () => {
    for (const route of [
      'InventoryItemDetail',
      'RentalListingDetail',
      'Cart',
      'CartCheckout',
      'PlaceOrder',
      'MobileMoneyAwaitingPayment',
      'OrderPlacedSuccess',
      'Login',
      'Signup',
      'OtpVerification',
      'ResetPassword',
      'ClientReels',
      'GuestReels',
      'AssistantChat',
      'OrderMessages',
      'Messages',
      'ThreadDetail',
      undefined,
    ]) {
      expect(shouldShowLauncher({ ...visible, route })).toBe(false);
      expect(shouldShowLauncher({ ...visible, viewer: 'guest', route })).toBe(false);
    }
  });

  it('hides behind the keyboard, sheets / modals, FTUE and the market prompt', () => {
    expect(shouldShowLauncher({ ...visible, keyboardOpen: true })).toBe(false);
    expect(shouldShowLauncher({ ...visible, suppressed: true })).toBe(false);
    expect(shouldShowLauncher({ ...visible, ftueShowing: true })).toBe(false);
    expect(shouldShowLauncher({ ...visible, marketPromptShowing: true })).toBe(false);
  });

  it('one entry point: the header button hides only where the launcher is allowed (flag on)', () => {
    expect(shouldHideHeaderAssistantButton(false, 'client', 'ClientBrowse')).toBe(false);
    expect(shouldHideHeaderAssistantButton(true, 'client', 'ClientBrowse')).toBe(true);
    expect(shouldHideHeaderAssistantButton(true, 'client', 'InventoryItemDetail')).toBe(false);
    expect(shouldHideHeaderAssistantButton(true, 'business', 'ClientBrowse')).toBe(false);
  });
});

describe('placement', () => {
  const base = { tabBarOverlayHeight: 100, bottomInset: 34 };
  // The 56 target is centred on the 52 character, so the character edge sits at the spec offset.
  it('tab screens: right 16, bottom overlay + 12 (character edge)', () => {
    expect(launcherPlacement({ ...base, route: 'ClientBrowse', cartFabVisible: false })).toEqual({ right: 14, bottom: 110 });
  });

  it('stack screens: insets.bottom + 16', () => {
    expect(launcherPlacement({ ...base, route: 'StoresList', cartFabVisible: false })).toEqual({ right: 14, bottom: 48 });
  });

  it('stacks above a visible cart FAB (cartBottom + 52 + 12)', () => {
    expect(launcherPlacement({ ...base, route: 'GuestBrowse', cartFabVisible: true })).toEqual({ right: 14, bottom: 100 + 16 + 52 + 12 - 2 });
    expect(launcherPlacement({ ...base, route: 'StoreDetail', cartFabVisible: true })).toEqual({ right: 14, bottom: 34 + 16 + 52 + 12 - 2 });
  });

  it('the cart FAB only counts on screens that mount it, with lines in the cart', () => {
    expect(cartFabVisibleOn('StoreDetail', 2)).toBe(true);
    expect(cartFabVisibleOn('StoreDetail', 0)).toBe(false);
    expect(cartFabVisibleOn('ClientOrders', 3)).toBe(false);
  });
});

describe('first-run nudge', () => {
  const ok = { seen: false, route: 'ClientBrowse', launcherVisible: true, ftueComplete: true, marketPromptThisSession: false };
  it('uses the v1 storage key', () => {
    expect(NUDGE_STORAGE_KEY).toBe('assistant.nudge.v1.seen');
  });
  it('shows once on browse home, after FTUE, without a market prompt', () => {
    expect(canShowNudge(ok)).toBe(true);
    expect(canShowNudge({ ...ok, route: 'GuestBrowse' })).toBe(true);
    expect(canShowNudge({ ...ok, seen: true })).toBe(false);
    expect(canShowNudge({ ...ok, seen: null })).toBe(false);
    expect(canShowNudge({ ...ok, route: 'ClientSearch' })).toBe(false);
    expect(canShowNudge({ ...ok, launcherVisible: false })).toBe(false);
    expect(canShowNudge({ ...ok, ftueComplete: false })).toBe(false);
    expect(canShowNudge({ ...ok, marketPromptThisSession: true })).toBe(false);
  });
});

describe('attention caps', () => {
  const day = 24 * 60 * 60 * 1000;
  it('parses stored history defensively', () => {
    expect(parseAttentionHistory(null)).toEqual([]);
    expect(parseAttentionHistory('nope')).toEqual([]);
    expect(parseAttentionHistory('{"a":1}')).toEqual([]);
    expect(parseAttentionHistory('[1,"x",2]')).toEqual([1, 2]);
  });
  it('1 per session, 3 per rolling 7 days', () => {
    const now = 100 * day;
    expect(canPlayAttention([], now, false)).toBe(true);
    expect(canPlayAttention([], now, true)).toBe(false);
    const three = [now - 6 * day, now - 3 * day, now - day];
    expect(canPlayAttention(three, now, false)).toBe(false);
    expect(canPlayAttention(three, now + day + 1, false)).toBe(true);
    expect(canPlayAttention([now - ATTENTION_WINDOW_MS, now - day, now - 2 * day], now, false)).toBe(true);
  });
  it('records and prunes old entries', () => {
    const now = 100 * day;
    expect(recordAttention([now - 8 * day, now - day], now)).toEqual([now - day, now]);
  });
  it('waits for 2 s of idle', () => {
    expect(attentionDelay(1000, 1000)).toBe(ATTENTION_IDLE_MS);
    expect(attentionDelay(1000, 2500)).toBe(500);
    expect(attentionDelay(1000, 9000)).toBe(0);
  });
});

describe('settle', () => {
  it('settles after 20 s without interaction', () => {
    expect(isSettled(0, SETTLE_AFTER_MS - 1)).toBe(false);
    expect(isSettled(0, SETTLE_AFTER_MS)).toBe(true);
  });
});
