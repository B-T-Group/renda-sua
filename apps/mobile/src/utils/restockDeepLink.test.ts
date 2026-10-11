import { describe, expect, it } from 'vitest';
import { extractAppPath, resolveDeepLinkTarget, targetPersonaForDeepLinkPath } from './appDeepLink';
import {
  parseRestockLink,
  parseRestockPush,
  restockPathToTarget,
  restockTargetToPath,
} from './restockDeepLink';

const ID = '11111111-2222-4333-8444-555555555555';

describe('parseRestockLink', () => {
  it('parses the backend item links (universal + custom scheme)', () => {
    expect(parseRestockLink(`https://rendasua.com/app/items/${ID}?src=restock_alert`)).toEqual({
      type: 'item',
      itemId: ID,
    });
    expect(parseRestockLink(`rendasua://items/${ID}?src=restock_alert`)).toEqual({
      type: 'item',
      itemId: ID,
    });
  });

  it('parses the digest link with the Back in stock filter', () => {
    expect(
      parseRestockLink('https://rendasua.com/app/likes?filter=back_in_stock&src=restock_alert')
    ).toEqual({ type: 'likes', filter: 'back_in_stock' });
    expect(parseRestockLink('rendasua://likes?filter=back_in_stock&src=restock_alert')).toEqual({
      type: 'likes',
      filter: 'back_in_stock',
    });
  });

  it('ignores business item-proposal links (no src)', () => {
    expect(parseRestockLink(`https://rendasua.com/app/items/${ID}`)).toBeNull();
    expect(extractAppPath(`https://rendasua.com/app/items/${ID}`)).toBe(`items/${ID}`);
  });
});

describe('restock paths through the app deep link resolver', () => {
  it('round-trips and targets the client persona', () => {
    const path = restockTargetToPath({ type: 'item', itemId: ID });
    expect(restockPathToTarget(path)).toEqual({ type: 'item', itemId: ID });
    expect(targetPersonaForDeepLinkPath(path)).toBe('client');
    expect(resolveDeepLinkTarget(path)).toEqual({ type: 'restockItem', itemId: ID });
    expect(resolveDeepLinkTarget('restock/likes/back_in_stock')).toEqual({
      type: 'restockLikes',
      filter: 'back_in_stock',
    });
  });
});

describe('parseRestockPush', () => {
  const single = {
    type: 'restock.alert',
    src: 'restock_alert',
    url: `https://rendasua.com/app/items/${ID}?src=restock_alert`,
    path: `/items/${ID}?src=restock_alert`,
    deepLink: `rendasua://items/${ID}?src=restock_alert`,
    stopToken: 'a'.repeat(30),
  };

  it('opens a single alert', () => {
    expect(parseRestockPush(single)).toMatchObject({ kind: 'open', target: { type: 'item', itemId: ID } });
  });

  it('opens a digest on Likes > Back in stock', () => {
    expect(
      parseRestockPush({ ...single, type: 'restock.digest', deepLink: undefined, url: undefined, path: '/likes?filter=back_in_stock&src=restock_alert' })
    ).toMatchObject({ kind: 'open', target: { type: 'likes', filter: 'back_in_stock' } });
  });

  it('maps the stop action to the single-use token', () => {
    expect(parseRestockPush(single, 'stop_restock_alerts')).toEqual({
      kind: 'stop',
      token: single.stopToken,
    });
  });

  it('ignores other notifications', () => {
    expect(parseRestockPush({ type: 'order.updated' })).toBeNull();
    expect(parseRestockPush(undefined)).toBeNull();
  });
});
