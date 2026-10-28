import { describe, expect, it, vi } from 'vitest';
import { extractAppPath, type DeepLinkTarget } from './appDeepLink';
import {
  flushDeepLink,
  isDeepLinkSignedIn,
  type DeepLinkAuth,
  type DeepLinkFlushDeps,
  type DeepLinkPersona,
} from './appDeepLinkFlush';

const STORE_ID = '82ed50dc-396a-4887-9b22-50b2d419f67c';
const ITEM_ID = '333d0d21-440a-4fe6-8449-00f5120aaca5';
const STORE_URL = `https://rendasua.com/store/${STORE_ID}`;
const ITEM_URL = `https://rendasua.com/items/${ITEM_ID}/seo`;

const signedInAuth: DeepLinkAuth = {
  isAuthenticated: true,
  tokens: { accessToken: 'tok' },
};
const guestAuth: DeepLinkAuth = { isAuthenticated: false, tokens: null };

function persona(over: Partial<DeepLinkPersona> = {}): DeepLinkPersona {
  return {
    showMainApp: true,
    activePersona: 'client',
    personas: ['client', 'business'],
    pickingPersona: null,
    isDelegationContext: false,
    selectPersona: vi.fn(async () => undefined),
    ...over,
  };
}

function pendingFor(url: string) {
  const path = extractAppPath(url);
  if (!path) throw new Error(`no path for ${url}`);
  return { path, routeAttempts: 0 };
}

function deps(over: Partial<DeepLinkFlushDeps> = {}) {
  const dispatch = vi.fn<DeepLinkFlushDeps['dispatch']>(() => true);
  return {
    dispatch,
    deps: { guestShellMounted: () => false, dispatch, ...over } as DeepLinkFlushDeps,
  };
}

describe('isDeepLinkSignedIn', () => {
  it('reads the token from auth.tokens (AuthStore has no top-level accessToken)', () => {
    expect(isDeepLinkSignedIn(signedInAuth, persona())).toBe(true);
    expect(isDeepLinkSignedIn({ isAuthenticated: true, tokens: null }, persona())).toBe(false);
    expect(isDeepLinkSignedIn(guestAuth, persona())).toBe(false);
    expect(isDeepLinkSignedIn(signedInAuth, persona({ showMainApp: false }))).toBe(false);
  });
});

describe('flushDeepLink: store share link (signed in)', () => {
  it('warm start: opens the store immediately in the active shell', () => {
    const { dispatch, deps: d } = deps();
    const result = flushDeepLink(pendingFor(STORE_URL), signedInAuth, persona(), d);
    expect(result).toBe('done');
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'store', id: STORE_ID } satisfies DeepLinkTarget,
      { persona: 'client', isDelegation: false, signedIn: true }
    );
  });

  it.each(['client', 'business', 'agent'] as const)(
    'warm start in the %s shell never falls through to the dashboard target',
    (activePersona) => {
      const { dispatch, deps: d } = deps();
      flushDeepLink(pendingFor(STORE_URL), signedInAuth, persona({ activePersona }), d);
      expect(dispatch.mock.calls[0][0]).toEqual({ type: 'store', id: STORE_ID });
    }
  );

  it('cold start: holds while the persona gate is up, then opens once the shell mounts', () => {
    const { dispatch, deps: d } = deps();
    const pending = pendingFor(STORE_URL);
    expect(flushDeepLink(pending, signedInAuth, persona({ showMainApp: false }), d)).toBe('hold');
    expect(dispatch).not.toHaveBeenCalled();
    expect(flushDeepLink(pending, signedInAuth, persona(), d)).toBe('done');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('cold start: retries (does not drop the link) while the store route is not mounted', () => {
    const dispatch = vi.fn<DeepLinkFlushDeps['dispatch']>().mockReturnValueOnce(false);
    dispatch.mockReturnValue(true);
    const d: DeepLinkFlushDeps = { guestShellMounted: () => false, dispatch };
    const pending = pendingFor(STORE_URL);
    expect(flushDeepLink(pending, signedInAuth, persona(), d)).toBe('retry');
    expect(flushDeepLink(pending, signedInAuth, persona(), d)).toBe('done');
  });

  it('does not switch persona for a store link', () => {
    const p = persona({ activePersona: 'business' });
    const { deps: d } = deps();
    flushDeepLink(pendingFor(STORE_URL), signedInAuth, p, d);
    expect(p.selectPersona).not.toHaveBeenCalled();
  });
});

describe('flushDeepLink: store share link (guest)', () => {
  it('cold start: holds until the guest shell is mounted, then opens the store', () => {
    let mounted = false;
    const { dispatch, deps: d } = deps({ guestShellMounted: () => mounted });
    const pending = pendingFor(STORE_URL);
    expect(flushDeepLink(pending, guestAuth, persona({ showMainApp: false }), d)).toBe('hold');
    mounted = true;
    expect(flushDeepLink(pending, guestAuth, persona({ showMainApp: false }), d)).toBe('done');
    expect(dispatch.mock.calls[0][1].signedIn).toBe(false);
  });

  it('warm start: opens immediately when the guest shell is up', () => {
    const { dispatch, deps: d } = deps({ guestShellMounted: () => true });
    expect(flushDeepLink(pendingFor(STORE_URL), guestAuth, persona({ showMainApp: false }), d)).toBe(
      'done'
    );
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'store', id: STORE_ID },
      expect.objectContaining({ signedIn: false })
    );
  });
});

describe('flushDeepLink: public item link', () => {
  it.each([
    ['client', true],
    ['business', true],
    ['guest', false],
  ])('opens the catalog item without persona switching (%s)', (kind, signed) => {
    const p = persona({
      activePersona: kind === 'business' ? 'business' : 'client',
      showMainApp: signed as boolean,
    });
    const { dispatch, deps: d } = deps({ guestShellMounted: () => true });
    const result = flushDeepLink(
      pendingFor(ITEM_URL),
      signed ? signedInAuth : guestAuth,
      p,
      d
    );
    expect(result).toBe('done');
    expect(dispatch.mock.calls[0][0]).toEqual({ type: 'inventoryItem', id: ITEM_ID });
    expect(p.selectPersona).not.toHaveBeenCalled();
  });

  it('cold start for a guest: holds until the guest shell mounts', () => {
    const { dispatch, deps: d } = deps({ guestShellMounted: () => false });
    expect(flushDeepLink(pendingFor(ITEM_URL), guestAuth, persona({ showMainApp: false }), d)).toBe(
      'hold'
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('cold start for a signed-in user: holds behind the persona gate', () => {
    const { dispatch, deps: d } = deps();
    expect(
      flushDeepLink(pendingFor(ITEM_URL), signedInAuth, persona({ showMainApp: false }), d)
    ).toBe('hold');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('flushDeepLink: existing links keep working', () => {
  it('business /app/items/:id still switches to the business persona for the AI proposal', () => {
    const p = persona({ activePersona: 'client' });
    const { dispatch, deps: d } = deps();
    const result = flushDeepLink(
      pendingFor(`https://rendasua.com/app/items/${ITEM_ID}`),
      signedInAuth,
      p,
      d
    );
    expect(result).toBe('hold');
    expect(p.selectPersona).toHaveBeenCalledWith('business');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('business /app/items/:id opens the proposal once on the business persona', () => {
    const { dispatch, deps: d } = deps();
    const result = flushDeepLink(
      pendingFor(`https://rendasua.com/app/items/${ITEM_ID}`),
      signedInAuth,
      persona({ activePersona: 'business' }),
      d
    );
    expect(result).toBe('done');
    expect(dispatch.mock.calls[0][0]).toEqual({ type: 'itemProposal', id: ITEM_ID });
  });

  it('account links wait for sign-in instead of opening for guests', () => {
    const { dispatch, deps: d } = deps({ guestShellMounted: () => true });
    expect(
      flushDeepLink(
        pendingFor('https://rendasua.com/app/orders/abc'),
        guestAuth,
        persona({ showMainApp: false }),
        d
      )
    ).toBe('wait');
    expect(dispatch).not.toHaveBeenCalled();
  });
});
