import {
  CATEGORY_ACTIONS,
  REJECTION_CATEGORIES,
  categoryActions,
  categoryAllows,
  categoryFromAiIssues,
  editedSinceRejection,
  slaState,
  statusDisplay,
} from './item-recovery.constants';

describe('rejected-item recovery rules', () => {
  it('maps every category to its §2 actions; prohibited/counterfeit allow appeal only', () => {
    expect(Object.keys(CATEGORY_ACTIONS).sort()).toEqual([...REJECTION_CATEGORIES].sort());
    expect(categoryActions('photo_quality').actions).toEqual(['ai_fix', 'retake', 'resubmit', 'appeal']);
    expect(categoryActions('pricing')).toEqual({ actions: ['resubmit', 'appeal'], resubmitEditLink: 'price', display: 'needs_changes' });
    expect(categoryActions('missing_info').resubmitEditLink).toBe('fields');
    for (const c of ['prohibited_item', 'counterfeit']) {
      expect(categoryActions(c)).toEqual({ actions: ['appeal'], resubmitEditLink: null, display: 'not_allowed' });
      expect(categoryAllows(c, 'resubmit')).toBe(false);
    }
    expect(categoryAllows('wrong_condition', 'ai_fix')).toBe(false);
    expect(categoryAllows('wrong_condition', 'condition')).toBe(true);
  });

  it('unknown/legacy categories fall back to other', () => {
    expect(categoryActions(null)).toBe(CATEGORY_ACTIONS.other);
    expect(categoryActions('nonsense')).toBe(CATEGORY_ACTIONS.other);
  });

  it('SLA state: ok before 75%, warning from 75%, breached at due', () => {
    const created = '2026-11-01T00:00:00Z';
    const due = '2026-11-03T00:00:00Z'; // 48 h
    expect(slaState(created, due, new Date('2026-11-02T11:59:00Z'))).toBe('ok');
    expect(slaState(created, due, new Date('2026-11-02T12:00:00Z'))).toBe('warning');
    expect(slaState(created, due, new Date('2026-11-03T00:00:00Z'))).toBe('breached');
  });

  it('status display: rejected splits needs_changes / not_allowed; review states are in_review', () => {
    expect(statusDisplay('rejected', 'pricing')).toBe('needs_changes');
    expect(statusDisplay('rejected', 'counterfeit')).toBe('not_allowed');
    expect(statusDisplay('pending', null)).toBe('in_review');
    expect(statusDisplay('ai_reviewing', null)).toBe('in_review');
    expect(statusDisplay('approved', null)).toBe('approved');
  });

  it('edited since rejection: strictly after, item or any image', () => {
    const at = '2026-11-01T10:00:00Z';
    expect(editedSinceRejection(at, { updated_at: at, item_images: [{ created_at: '2026-10-01T00:00:00Z', updated_at: at }] })).toBe(false);
    expect(editedSinceRejection(at, { updated_at: '2026-11-01T10:00:01Z' })).toBe(true);
    expect(editedSinceRejection(at, { updated_at: at, item_images: [{ created_at: '2026-11-01T11:00:00Z' }] })).toBe(true);
  });

  it('AI issues → category', () => {
    expect(categoryFromAiIssues([])).toBe('other');
    expect(categoryFromAiIssues([{ field: 'images', code: 'blurry' }])).toBe('photo_quality');
    expect(categoryFromAiIssues([{ field: 'images' }, { field: 'price' }])).toBe('pricing');
    expect(categoryFromAiIssues([{ field: 'title', code: 'counterfeit_brand' }])).toBe('counterfeit');
    expect(categoryFromAiIssues([{ field: 'description', code: 'prohibited_weapon' }])).toBe('prohibited_item');
    expect(categoryFromAiIssues([{ field: 'description', code: 'condition_mismatch' }])).toBe('wrong_condition');
    expect(categoryFromAiIssues([{ field: 'title' }])).toBe('missing_info');
  });
});
