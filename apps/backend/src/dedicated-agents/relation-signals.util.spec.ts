import { relationBadge, relationSignals, type RelationInput } from './relation-signals.util';

const base: RelationInput = {
  agentId: 'ag-1',
  isInternal: false,
  agentPhones: ['+237677000111', null],
  businessId: 'biz-1',
  businessPhones: ['+237699000222', null, ''],
  businessReferredByAgentId: null,
  agentReferredByBusinessId: null,
  dismissedAt: null,
};

describe('relation signals (AC-S5)', () => {
  it('no shared phone and no referral: no badge', () => {
    expect(relationBadge(base)).toEqual({ possible_relation: false, relation_signals: [], relation_dismissed: false });
  });

  it('a shared phone alone sets the badge, across +237 / 237 / leading-0 / spaced forms', () => {
    for (const businessPhone of ['+237677000111', '237677000111', '0677000111', '6 77 00 01 11', '677-000-111']) {
      expect(relationBadge({ ...base, businessPhones: [businessPhone] })).toEqual({
        possible_relation: true,
        relation_signals: ['shared_phone'],
        relation_dismissed: false,
      });
    }
  });

  it('the agent MoMo phone counts as an agent phone', () => {
    expect(relationSignals({ ...base, agentPhones: [null, '0699000222'] })).toEqual(['shared_phone']);
  });

  it('the business was referred by this agent: referral_link alone', () => {
    expect(relationSignals({ ...base, businessReferredByAgentId: 'ag-1' })).toEqual(['referral_link']);
    expect(relationSignals({ ...base, businessReferredByAgentId: 'ag-other' })).toEqual([]);
  });

  it('the agent was referred by this business: referral_link alone', () => {
    expect(relationSignals({ ...base, agentReferredByBusinessId: 'biz-1' })).toEqual(['referral_link']);
    expect(relationSignals({ ...base, agentReferredByBusinessId: 'biz-other' })).toEqual([]);
  });

  it('both signals together, in a stable order', () => {
    expect(relationSignals({ ...base, businessPhones: ['0677000111'], businessReferredByAgentId: 'ag-1' })).toEqual([
      'shared_phone',
      'referral_link',
    ]);
  });

  it('never emits shared_device (no device ids are stored)', () => {
    const all = relationSignals({ ...base, businessPhones: ['0677000111'], businessReferredByAgentId: 'ag-1', agentReferredByBusinessId: 'biz-1' });
    expect(all).not.toContain('shared_device');
  });

  it('short or blank numbers never match (no false badge on partial digits)', () => {
    expect(relationSignals({ ...base, agentPhones: ['111'], businessPhones: ['0677000111'] })).toEqual([]);
    expect(relationSignals({ ...base, agentPhones: ['  '], businessPhones: ['  '] })).toEqual([]);
    expect(relationSignals({ ...base, agentPhones: [], businessPhones: [] })).toEqual([]);
  });

  it('internal agents never get the badge (AC-S5 is about independents)', () => {
    expect(relationBadge({ ...base, isInternal: true, businessPhones: ['0677000111'], businessReferredByAgentId: 'ag-1' })).toEqual({
      possible_relation: false,
      relation_signals: [],
      relation_dismissed: false,
    });
  });

  it('a dismissed badge stays dismissed while the signals stay listed for audit', () => {
    expect(relationBadge({ ...base, businessReferredByAgentId: 'ag-1', dismissedAt: '2026-10-19T10:00:00Z' })).toEqual({
      possible_relation: false,
      relation_signals: ['referral_link'],
      relation_dismissed: true,
    });
  });
});
