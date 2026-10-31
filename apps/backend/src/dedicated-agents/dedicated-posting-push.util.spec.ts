import { postingPushSkipReason, type PostingPushCandidate } from './dedicated-posting-push.util';

const store = { city: 'Douala', state: 'Littoral', country: 'CM' };
const agent = (over: Partial<PostingPushCandidate> = {}): PostingPushCandidate => ({
  id: 'a1',
  user_id: 'u1',
  status: 'active',
  focus: 'delivery',
  is_verified: true,
  is_internal: false,
  agent_addresses: [{ address: { city: ' douala ', state: 'Littoral', country: 'cm', is_primary: true } }],
  ...over,
});

describe('postingPushSkipReason (AC-P13)', () => {
  it('eligible: in city (normalised), all slots on by default', () => {
    expect(postingPushSkipReason(agent(), store, ['morning', 'evening'])).toBeNull();
  });
  it('needs ALL posting slots on', () => {
    expect(postingPushSkipReason(agent({ pref_evening: false }), store, ['morning', 'evening'])).toBe('slots');
    expect(postingPushSkipReason(agent({ pref_evening: false }), store, ['morning'])).toBeNull();
    expect(postingPushSkipReason(agent(), store, [])).toBe('slots');
  });
  it('skips no address and city misses', () => {
    expect(postingPushSkipReason(agent({ agent_addresses: [] }), store, ['morning'])).toBe('no_address');
    expect(
      postingPushSkipReason(agent({ agent_addresses: [{ address: { city: 'Yaoundé', state: 'Centre', country: 'CM' } }] }), store, ['morning'])
    ).toBe('city');
    expect(
      postingPushSkipReason(agent({ agent_addresses: [{ address: { city: 'Bonaberi', state: 'Littoral', country: 'CM' } }] }), store, ['morning'])
    ).toBe('city');
  });
  it.each([
    [{ user_id: null }, 'no_user'],
    [{ is_verified: false }, 'ineligible'],
    [{ is_internal: true }, 'ineligible'],
    [{ status: 'suspended' }, 'ineligible'],
    [{ focus: 'commercial' }, 'ineligible'],
  ])('skips %j', (over, reason) => {
    expect(postingPushSkipReason(agent(over as Partial<PostingPushCandidate>), store, ['morning'])).toBe(reason);
  });
});
