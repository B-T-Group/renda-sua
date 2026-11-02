import { HttpException } from '@nestjs/common';
import * as Q from './item-recovery.queries';
import { RESET_ITEM_PENDING } from '../item-ai-review/item-ai-review.queries';
import { ItemAppealsService, overturnTarget, validateAppealInput, validateCondition } from './item-appeals.service';

const BIZ = 'b1';
const REASON = 'The photo shows the real item, label visible';
const codeOf = async (p: Promise<unknown> | (() => unknown)) => {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    return ((e as HttpException).getResponse() as any).code;
  }
  return 'NO_THROW';
};

function rejectedItem(over: Record<string, any> = {}) {
  return {
    id: 'i1',
    name: 'Lamp',
    business_id: BIZ,
    status: 'active',
    moderation_status: 'rejected',
    rejection_category: 'photo_quality',
    condition: 'new',
    wear_note: null,
    updated_at: '2026-11-01T10:00:00Z',
    business: { id: BIZ, user_id: 'owner', name: 'Shop' },
    item_images: [],
    current_rejection: { id: 'r1', category: 'photo_quality', reason: 'blurry', reviewer_id: 'mod1', source: 'admin', created_at: '2026-11-01T10:00:00Z' },
    appeals: [],
    ...over,
  };
}

function pendingAppeal(over: Record<string, any> = {}) {
  return {
    id: 'a1',
    rejection_id: 'r1',
    item_id: 'i1',
    business_id: BIZ,
    status: 'pending',
    reason: REASON,
    evidence_keys: [],
    created_at: '2026-11-01T11:00:00Z',
    sla_due_at: '2026-11-03T11:00:00Z',
    rejection: { id: 'r1', category: 'photo_quality', reason: 'blurry', reviewer_id: 'mod1', source: 'admin', created_at: '2026-11-01T10:00:00Z' },
    business: { id: BIZ, name: 'Shop', user_id: 'owner' },
    item: { id: 'i1', name: 'Lamp', updated_at: '2026-11-01T10:00:00Z', item_images: [] },
    ...over,
  };
}

function setup(opts: { item?: any; appeal?: any; config?: any[]; others?: { roles: number; perms: number }; mutation?: (q: string, v: any) => any } = {}) {
  const hasura = {
    executeQuery: jest.fn(async (q: string) => {
      if (q === Q.ITEM_RECOVERY_STATE) return { items_by_pk: opts.item ?? null, ai_image_cleanup_jobs_aggregate: { aggregate: { sum: { tokens_consumed: 2 } } } };
      if (q === Q.APPEAL_CONFIG) return { application_configurations: opts.config ?? [] };
      if (q === Q.BUSINESS_TOKEN_BALANCE) return { businesses_by_pk: { ai_tokens: 3 } };
      if (q === Q.APPEAL_DETAIL) return { item_appeals_by_pk: opts.appeal ?? null };
      if (q === Q.OTHER_ITEM_MODERATORS)
        return {
          user_roles: Array(opts.others?.roles ?? 0).fill({ user_id: 'x' }),
          user_permissions: Array(opts.others?.perms ?? 0).fill({ user_id: 'y' }),
        };
      if (q === Q.USER_FOR_NOTICE) return { users_by_pk: { preferred_language: 'fr' } };
      return {};
    }),
    executeMutation: jest.fn(async (q: string, v: any) => {
      if (opts.mutation) {
        const r = opts.mutation(q, v);
        if (r !== undefined) return r;
      }
      if (q === Q.INSERT_APPEAL) return { insert_item_appeals_one: { id: 'new', ...v.object, status: 'pending', created_at: '2026-11-01T12:00:00Z' } };
      if (q === RESET_ITEM_PENDING) return { update_items_by_pk: { id: v.id } };
      if (q === Q.UPHOLD_APPEAL) return { update_item_appeals: { affected_rows: 1 } };
      if (q === Q.OVERTURN_APPEAL) return { appeal: { affected_rows: 1 }, item: { affected_rows: 1 } };
      if (q === Q.SET_ITEM_CONDITION) return { update_items_by_pk: { condition: v.condition, wear_note: v.wearNote, is_used: v.condition !== 'new' } };
      return {};
    }),
  };
  const rejections = {
    assertResubmitAllowed: jest.fn().mockResolvedValue({ resubmit: true, withdrawsAppealId: null, category: 'photo_quality', rejectedAt: null }),
    noteResubmitted: jest.fn().mockResolvedValue(undefined),
    noteApproved: jest.fn().mockResolvedValue(undefined),
    audit: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { sendItemAppealNotice: jest.fn().mockResolvedValue(undefined) };
  const aiReview = { requestReview: jest.fn().mockResolvedValue(undefined) };
  const activation = { assertItemCanActivateAsSystem: jest.fn().mockResolvedValue(undefined) };
  const lifecycle = { recompute: jest.fn().mockResolvedValue(undefined) };
  const siteEvents = { trackEvent: jest.fn().mockResolvedValue(undefined) };
  const aws = {
    getDefaultBucketName: jest.fn(() => 'rs-bucket'),
    getBucketRegion: jest.fn(() => 'ca-central-1'),
    generatePresignedDownloadUrl: jest.fn(async (o: any) => ({
      url: `https://${o.bucketName}.s3.ca-central-1.amazonaws.com/${o.key}?X-Amz-Expires=${o.expiresIn}&X-Amz-Signature=sig`,
      expiresAt: new Date('2026-11-01T12:15:00Z'),
    })),
    generateStrictUploadUrl: jest.fn(async (o: any) => ({ url: `https://signed/${o.key}`, expiresAt: new Date('2026-11-01T12:10:00Z'), signedHeaders: [] })),
  };
  const s = new ItemAppealsService(
    hasura as any,
    rejections as any,
    notifications as any,
    aiReview as any,
    activation as any,
    lifecycle as any,
    aws as any,
    siteEvents as any
  );
  return { s, hasura, rejections, notifications, aiReview, activation, siteEvents, aws };
}

const ITEM = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const OTHER_ITEM = '0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e';
const FILE = '11111111-2222-4333-8444-555555555555';
const EV = { itemId: ITEM };
const evKey = (file = FILE, ext = 'jpg', item = ITEM) => `item-appeal-evidence/${item}/${file}.${ext}`;
const PRIVATE_BUCKET = 'rendasua-user-uploads';

const mutationsOf = (h: any, q: string) => h.executeMutation.mock.calls.filter((c: any[]) => c[0] === q);

describe('appeal input rules', () => {
  it('reason 20–500 after trim; evidence ≤ 3 of our own upload keys', () => {
    expect(validateAppealInput(`  ${'a'.repeat(20)}  `, undefined, EV)).toEqual({ reason: 'a'.repeat(20), evidenceKeys: [] });
    const four = [1, 2, 3, 4].map((n) => evKey(`${n}0000000-0000-4000-8000-000000000000`));
    return Promise.all([
      codeOf(() => validateAppealInput('a'.repeat(19), [], EV)).then((c) => expect(c).toBe('ITEM_APPEAL_REASON_LENGTH')),
      codeOf(() => validateAppealInput('a'.repeat(501), [], EV)).then((c) => expect(c).toBe('ITEM_APPEAL_REASON_LENGTH')),
      codeOf(() => validateAppealInput(REASON, four, EV)).then((c) => expect(c).toBe('ITEM_APPEAL_EVIDENCE_LIMIT')),
      codeOf(() => validateAppealInput(REASON, [evKey(), evKey()], EV)).then((c) => expect(c).toBe('ITEM_APPEAL_EVIDENCE_URL_INVALID')),
    ]);
  });

  it('evidence must be a private key for this item, uuid raster file — no URLs, nothing else', async () => {
    expect(validateAppealInput(REASON, [evKey(), evKey(OTHER_ITEM, 'webp')], EV).evidenceKeys).toEqual([evKey(), evKey(OTHER_ITEM, 'webp')]);
    expect(validateAppealInput(REASON, [evKey()], { itemId: ITEM.toUpperCase() }).evidenceKeys).toEqual([evKey()]);
    const bad = [
      `https://rendasua-uploads.s3.amazonaws.com/items/${ITEM}/appeal-evidence/${FILE}.jpg`, // old public-URL shape
      `https://rendasua-user-uploads.s3.ca-central-1.amazonaws.com/${evKey()}`, // URL, even of the private bucket
      `items/${ITEM}/appeal-evidence/${FILE}.jpg`, // old public prefix
      `/${evKey()}`,
      evKey(FILE, 'jpg', OTHER_ITEM), // another item's evidence
      `item-appeal-evidence/${ITEM}/../${OTHER_ITEM}/${FILE}.jpg`,
      `item-appeal-evidence/${ITEM}/%2e%2e/${FILE}.jpg`,
      `item-appeal-evidence/${ITEM}/sub/${FILE}.jpg`,
      evKey(FILE, 'svg'), // SVG refused
      evKey(FILE, 'SVG'),
      evKey(FILE, 'jpg.svg'),
      evKey(FILE, 'html'),
      evKey('not-a-uuid'),
      evKey('a'.repeat(36)), // right length/charset, not a uuid
      evKey('-'.repeat(36)),
      evKey('ABCDEF00-2222-4333-8444-555555555555'), // we only issue lowercase
      `${evKey()}?x=1`,
      `${evKey()}x`,
      `x${evKey()}`,
      42 as any,
      null as any,
    ];
    for (const u of bad) {
      expect([u, await codeOf(() => validateAppealInput(REASON, [u], EV))]).toEqual([u, 'ITEM_APPEAL_EVIDENCE_URL_INVALID']);
    }
  });

  it('wear note required unless new; new clears it', async () => {
    expect(validateCondition('new', 'whatever')).toEqual({ condition: 'new', wearNote: null });
    expect(validateCondition('used', '  Scratches on the base  ')).toEqual({ condition: 'used', wearNote: 'Scratches on the base' });
    expect(await codeOf(() => validateCondition('used', ''))).toBe('ITEM_WEAR_NOTE_REQUIRED');
    expect(await codeOf(() => validateCondition('refurbished', 'short'))).toBe('ITEM_WEAR_NOTE_LENGTH');
    expect(await codeOf(() => validateCondition('refurbished', 'x'.repeat(301)))).toBe('ITEM_WEAR_NOTE_LENGTH');
  });

  it('overturn goes back to review when edited or asked', () => {
    expect(overturnTarget(undefined, false)).toBe('approved');
    expect(overturnTarget('approve', true)).toBe('pending');
    expect(overturnTarget('re_review', false)).toBe('pending');
  });
});

describe('ItemAppealsService (business)', () => {
  it('another business gets 403 ITEM_APPEAL_NOT_OWNER', async () => {
    const { s } = setup({ item: rejectedItem({ business_id: 'other' }) });
    expect(await codeOf(s.createAppeal(BIZ, 'u1', 'i1', { reason: REASON }))).toBe('ITEM_APPEAL_NOT_OWNER');
    expect(await codeOf(s.getRecovery(BIZ, 'i1'))).toBe('ITEM_APPEAL_NOT_OWNER');
  });

  it('only rejected items can be appealed', async () => {
    expect(await codeOf(setup({ item: rejectedItem({ moderation_status: 'pending' }) }).s.createAppeal(BIZ, 'u', 'i1', { reason: REASON }))).toBe(
      'ITEM_RESUBMIT_PENDING'
    );
    expect(await codeOf(setup({ item: rejectedItem({ moderation_status: 'approved' }) }).s.createAppeal(BIZ, 'u', 'i1', { reason: REASON }))).toBe(
      'ITEM_NOT_REJECTED'
    );
  });

  it('one pending appeal at a time; config limit counts non-withdrawn appeals for this rejection', async () => {
    const pending = setup({ item: rejectedItem({ appeals: [{ id: 'a0', rejection_id: 'r1', status: 'pending' }] }) });
    expect(await codeOf(pending.s.createAppeal(BIZ, 'u', 'i1', { reason: REASON }))).toBe('ITEM_APPEAL_ALREADY_PENDING');

    const used = setup({ item: rejectedItem({ appeals: [{ id: 'a0', rejection_id: 'r1', status: 'upheld' }] }) });
    expect(await codeOf(used.s.createAppeal(BIZ, 'u', 'i1', { reason: REASON }))).toBe('ITEM_APPEAL_LIMIT_REACHED');

    // withdrawn appeals and appeals on an older rejection do not count
    const fresh = setup({
      item: rejectedItem({
        appeals: [
          { id: 'a0', rejection_id: 'r1', status: 'withdrawn' },
          { id: 'old', rejection_id: 'r0', status: 'upheld' },
        ],
      }),
    });
    await expect(fresh.s.createAppeal(BIZ, 'u', 'i1', { reason: REASON })).resolves.toMatchObject({ status: 'pending' });

    const two = setup({ item: rejectedItem({ appeals: [{ id: 'a0', rejection_id: 'r1', status: 'upheld' }] }), config: [{ config_key: 'item_appeal_limit_per_rejection', number_value: 2 }] });
    await expect(two.s.createAppeal(BIZ, 'u', 'i1', { reason: REASON })).resolves.toMatchObject({ status: 'pending' });
  });

  it('creates the appeal with the configured SLA, audit row, and EN/FR notice', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-01T12:00:00Z'));
    try {
      const { s, hasura, notifications } = setup({ item: rejectedItem({ id: ITEM }), config: [{ config_key: 'item_appeal_sla_hours', number_value: 24 }] });
      const out = await s.createAppeal(BIZ, 'u1', ITEM, { reason: `  ${REASON} `, evidenceKeys: [`  ${evKey()} `] });
      const [[, vars]] = mutationsOf(hasura, Q.INSERT_APPEAL);
      expect(vars.object).toMatchObject({
        rejection_id: 'r1',
        item_id: ITEM,
        business_id: BIZ,
        submitted_by_user_id: 'u1',
        reason: REASON,
        evidence_keys: [evKey()],
        sla_due_at: '2026-11-02T12:00:00.000Z',
      });
      expect(vars.audit).toMatchObject({ action: 'appeal_created', rejection_id: 'r1' });
      expect(out).toMatchObject({ slaDueAt: '2026-11-02T12:00:00.000Z', slaState: 'ok' });
      expect(out.evidence).toEqual([
        { key: evKey(), url: expect.stringContaining(`https://${PRIVATE_BUCKET}.s3.ca-central-1.amazonaws.com/${evKey()}?X-Amz-Expires=900`), expiresAt: '2026-11-01T12:15:00.000Z' },
      ]);
      expect(out).not.toHaveProperty('evidenceUrls');
      const notice = notifications.sendItemAppealNotice.mock.calls[0][0];
      expect(notice).toMatchObject({ userId: 'owner', messageType: 'item_appeal_received', emailTemplateKey: 'business_item_appeal_received' });
      expect(notice.title).toBe('Recours reçu');
    } finally {
      jest.useRealTimers();
    }
  });

  it('a unique-index race maps to ITEM_APPEAL_ALREADY_PENDING', async () => {
    const { s } = setup({
      item: rejectedItem(),
      mutation: (q) => {
        if (q === Q.INSERT_APPEAL) throw new Error('Uniqueness violation. duplicate key value violates unique constraint "item_appeals_one_pending_per_rejection"');
        return undefined;
      },
    });
    expect(await codeOf(s.createAppeal(BIZ, 'u', 'i1', { reason: REASON }))).toBe('ITEM_APPEAL_ALREADY_PENDING');
  });

  it('resubmit uses the strict gate, resets to pending, and re-queues review', async () => {
    const { s, rejections, hasura, aiReview } = setup({ item: rejectedItem() });
    await expect(s.resubmit(BIZ, 'u1', 'i1', { confirmWithdrawAppeal: true })).resolves.toMatchObject({ moderationStatus: 'pending' });
    expect(rejections.assertResubmitAllowed).toHaveBeenCalledWith('i1', { confirmWithdrawAppeal: true, strict: true });
    expect(mutationsOf(hasura, RESET_ITEM_PENDING)).toHaveLength(1);
    expect(rejections.noteResubmitted).toHaveBeenCalled();
    expect(aiReview.requestReview).toHaveBeenCalledWith('i1');
  });

  it('resubmit does not write when the gate refuses', async () => {
    const { s, rejections, hasura } = setup({ item: rejectedItem() });
    rejections.assertResubmitAllowed.mockRejectedValue(new HttpException({ code: 'ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED' }, 409));
    expect(await codeOf(s.resubmit(BIZ, 'u1', 'i1', {}))).toBe('ITEM_APPEAL_WITHDRAW_CONFIRM_REQUIRED');
    expect(mutationsOf(hasura, RESET_ITEM_PENDING)).toHaveLength(0);
  });

  it('condition change is blocked for categories without that action', async () => {
    const { s, hasura } = setup({ item: rejectedItem({ rejection_category: 'pricing' }) });
    expect(await codeOf(s.setCondition(BIZ, 'u', 'i1', { condition: 'used', wearNote: 'Scratches on the base' }))).toBe(
      'ITEM_ACTION_NOT_ALLOWED_FOR_CATEGORY'
    );
    expect(mutationsOf(hasura, Q.SET_ITEM_CONDITION)).toHaveLength(0);
    const ok = setup({ item: rejectedItem({ rejection_category: 'wrong_condition' }) });
    await expect(ok.s.setCondition(BIZ, 'u', 'i1', { condition: 'used', wearNote: 'Scratches on the base' })).resolves.toEqual({
      itemId: 'i1',
      condition: 'used',
      wearNote: 'Scratches on the base',
      isUsed: true,
    });
  });

  it('recovery state: actions, appeal eligibility, and token info', async () => {
    const { s } = setup({ item: rejectedItem({ rejection_category: 'counterfeit', current_rejection: { ...rejectedItem().current_rejection, category: 'counterfeit', reviewer_id: null } }) });
    const r = await s.getRecovery(BIZ, 'i1');
    expect(r).toMatchObject({
      actions: ['appeal'],
      canAppeal: true,
      canResubmit: false,
      appealLimit: 1,
      appealsUsed: 0,
      item: { statusDisplay: 'not_allowed' },
      rejection: { category: 'counterfeit', decidedBy: 'ai' },
      aiCleanup: { costPerImage: 1, tokenBalance: 3, tokensSpentOnItem: 2 },
    });
  });

  it('cleanup quote flags insufficient tokens with the existing code', async () => {
    const { s } = setup({ item: rejectedItem() });
    await expect(s.cleanupQuote(BIZ, 'i1', 5)).resolves.toMatchObject({ totalCost: 5, tokenBalance: 3, sufficient: false, shortfall: 2, code: 'INSUFFICIENT_AI_TOKENS' });
    await expect(s.cleanupQuote(BIZ, 'i1', 2)).resolves.toMatchObject({ sufficient: true, code: null });
  });
});

describe('ItemAppealsService (admin decide)', () => {
  it('uphold requires a note and stores the corrected category', async () => {
    const { s, hasura } = setup({ appeal: pendingAppeal() });
    expect(await codeOf(s.decide('a1', 'mod2', { decision: 'uphold', note: '  ' }))).toBe('ITEM_APPEAL_UPHOLD_NOTE_REQUIRED');
    await expect(s.decide('a1', 'mod2', { decision: 'uphold', note: 'Still blurry', correctedCategory: 'pricing' })).resolves.toMatchObject({
      status: 'upheld',
      itemModerationStatus: 'rejected',
    });
    expect(mutationsOf(hasura, Q.UPHOLD_APPEAL)[0][1].appealSet).toMatchObject({ status: 'upheld', admin_id: 'mod2', admin_note: 'Still blurry' });
    expect(mutationsOf(hasura, Q.CORRECT_CATEGORY)[0][1]).toEqual({ itemId: 'i1', rejectionId: 'r1', category: 'pricing' });
  });

  it('already decided → 409 ITEM_APPEAL_NOT_PENDING, nothing written', async () => {
    const { s, hasura } = setup({ appeal: pendingAppeal({ status: 'upheld' }) });
    expect(await codeOf(s.decide('a1', 'mod2', { decision: 'overturn' }))).toBe('ITEM_APPEAL_NOT_PENDING');
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });

  it('a concurrent decide (0 rows) → 409', async () => {
    const { s } = setup({ appeal: pendingAppeal(), mutation: (q) => (q === Q.OVERTURN_APPEAL ? { appeal: { affected_rows: 0 }, item: { affected_rows: 0 } } : undefined) });
    expect(await codeOf(s.decide('a1', 'mod2', { decision: 'overturn' }))).toBe('ITEM_APPEAL_NOT_PENDING');
  });

  it('self-review is blocked when another moderator exists, allowed with a warning otherwise', async () => {
    const blocked = setup({ appeal: pendingAppeal(), others: { roles: 1, perms: 0 } });
    expect(await codeOf(blocked.s.decide('a1', 'mod1', { decision: 'overturn' }))).toBe('ITEM_APPEAL_SELF_REVIEW_BLOCKED');
    expect(blocked.hasura.executeMutation).not.toHaveBeenCalled();
    const alone = setup({ appeal: pendingAppeal(), others: { roles: 0, perms: 0 } });
    await expect(alone.s.decide('a1', 'mod1', { decision: 'overturn' })).resolves.toMatchObject({ warnings: ['SELF_REVIEW_NO_OTHER_ADMIN'] });
    const other = setup({ appeal: pendingAppeal(), others: { roles: 1, perms: 1 } });
    await expect(other.s.decide('a1', 'mod2', { decision: 'overturn' })).resolves.toMatchObject({ warnings: [] });
  });

  it('overturn on an unedited item approves (after activation checks), no token refund', async () => {
    const { s, hasura, activation, rejections, notifications } = setup({ appeal: pendingAppeal() });
    await expect(s.decide('a1', 'mod2', { decision: 'overturn' })).resolves.toMatchObject({ status: 'overturned', itemModerationStatus: 'approved' });
    expect(activation.assertItemCanActivateAsSystem).toHaveBeenCalledWith('i1');
    const [[, vars]] = mutationsOf(hasura, Q.OVERTURN_APPEAL);
    expect(vars.itemSet).toMatchObject({ moderation_status: 'approved', is_active: true });
    expect(vars.appealSet).toMatchObject({ status: 'overturned', outcome_moderation_status: 'approved' });
    expect(rejections.noteApproved).toHaveBeenCalledWith('i1', 'appeal');
    expect(hasura.executeMutation.mock.calls.some(([q]: any[]) => /ai_tokens/.test(q))).toBe(false);
    expect(notifications.sendItemAppealNotice.mock.calls[0][0]).toMatchObject({ messageType: 'item_appeal_decided' });
  });

  it('overturn on an item edited since the rejection goes back to review even if approve was asked', async () => {
    const { s, hasura, activation, aiReview } = setup({
      appeal: pendingAppeal({ item: { id: 'i1', name: 'Lamp', updated_at: '2026-11-01T10:30:00Z', item_images: [] } }),
    });
    await expect(s.decide('a1', 'mod2', { decision: 'overturn', overturnTo: 'approve' })).resolves.toMatchObject({ itemModerationStatus: 'pending' });
    expect(activation.assertItemCanActivateAsSystem).not.toHaveBeenCalled();
    expect(mutationsOf(hasura, Q.OVERTURN_APPEAL)[0][1].itemSet).toMatchObject({ moderation_status: 'pending', is_active: false });
    expect(aiReview.requestReview).toHaveBeenCalledWith('i1');
  });

  it('queue defaults to pending, filters category/business, and reports SLA state', async () => {
    const { s, hasura } = setup();
    hasura.executeQuery.mockImplementationOnce(async () => ({
      item_appeals: [pendingAppeal({ sla_due_at: '2000-01-01T00:00:00Z', created_at: '1999-12-30T00:00:00Z' })],
      item_appeals_aggregate: { aggregate: { count: 1 } },
    }));
    const out = await s.listQueue({ category: 'pricing', businessId: BIZ });
    expect(hasura.executeQuery.mock.calls[0][1]).toEqual({
      where: { status: { _eq: 'pending' }, rejection: { category: { _eq: 'pricing' } }, business_id: { _eq: BIZ } },
      limit: 50,
      offset: 0,
    });
    expect(out.appeals[0].slaState).toBe('breached');
  });
});

describe('appeal evidence upload URL', () => {
  it('issues a 10-minute PUT into the PRIVATE bucket under item-appeal-evidence/{itemId}/ with type + size pinned', async () => {
    const { s, aws } = setup({ item: rejectedItem({ id: ITEM }) });
    const out = await s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/JPG', fileSize: 1234 });
    const [[o]] = aws.generateStrictUploadUrl.mock.calls;
    expect(o).toMatchObject({ bucketName: PRIVATE_BUCKET, contentType: 'image/jpeg', contentLength: 1234, expiresIn: 600 });
    expect(o.key).toMatch(new RegExp(`^item-appeal-evidence/${ITEM}/[0-9a-f-]{36}\\.jpg$`));
    expect(out).toMatchObject({ method: 'PUT', key: o.key, headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1234' }, maxBytes: 5 * 1024 * 1024 });
    // no viewable URL is handed out at upload time; the key is exactly what createAppeal accepts for this item
    expect(Object.keys(out).sort()).toEqual(['expiresAt', 'headers', 'key', 'maxBytes', 'method', 'uploadUrl']);
    expect(validateAppealInput(REASON, [out.key], EV).evidenceKeys).toEqual([out.key]);
    expect(await codeOf(() => validateAppealInput(REASON, [out.key], { itemId: OTHER_ITEM }))).toBe('ITEM_APPEAL_EVIDENCE_URL_INVALID');
    expect(aws.getDefaultBucketName).not.toHaveBeenCalled(); // never the public uploads bucket
  });

  it('APPEAL_EVIDENCE_BUCKET overrides the private bucket for upload and view', async () => {
    process.env.APPEAL_EVIDENCE_BUCKET = 'rs-private-evidence';
    try {
      const { s, aws } = setup({ item: rejectedItem({ id: ITEM }) });
      await s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/png', fileSize: 10 });
      expect(aws.generateStrictUploadUrl.mock.calls[0][0].bucketName).toBe('rs-private-evidence');
      const d = setup({ appeal: pendingAppeal({ item_id: ITEM, evidence_keys: [evKey()] }) });
      await d.s.detail('a1', 'mod2');
      expect(d.aws.generatePresignedDownloadUrl.mock.calls[0][0].bucketName).toBe('rs-private-evidence');
    } finally {
      delete process.env.APPEAL_EVIDENCE_BUCKET;
    }
  });

  it('refuses SVG / non-images and bad sizes before signing anything', async () => {
    const { s, aws } = setup({ item: rejectedItem({ id: ITEM }) });
    for (const ct of ['image/svg+xml', 'image/svg+xml; charset=utf-8', 'text/html', 'image/gif', 'application/octet-stream', undefined]) {
      expect(await codeOf(() => s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: ct, fileSize: 10 }))).toBe('ITEM_APPEAL_EVIDENCE_TYPE_UNSUPPORTED');
    }
    for (const size of [0, -1, 1.5, 5 * 1024 * 1024 + 1, '100' as any, undefined]) {
      expect(await codeOf(() => s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/png', fileSize: size }))).toBe('ITEM_APPEAL_EVIDENCE_TOO_LARGE');
    }
    await expect(s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/webp', fileSize: 5 * 1024 * 1024 })).resolves.toBeTruthy();
    expect(aws.generateStrictUploadUrl).toHaveBeenCalledTimes(1);
  });

  it('only for the owner\'s rejected item', async () => {
    const other = setup({ item: rejectedItem({ id: ITEM, business_id: 'someone-else', business: { id: 'someone-else', user_id: 'x', name: 'X' } }) });
    expect(await codeOf(() => other.s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/png', fileSize: 10 }))).toBe('ITEM_APPEAL_NOT_OWNER');
    const approved = setup({ item: rejectedItem({ id: ITEM, moderation_status: 'approved' }) });
    expect(await codeOf(() => approved.s.createEvidenceUploadUrl(BIZ, ITEM, { contentType: 'image/png', fileSize: 10 }))).toBe('ITEM_NOT_REJECTED');
    expect(other.aws.generateStrictUploadUrl).not.toHaveBeenCalled();
    expect(approved.aws.generateStrictUploadUrl).not.toHaveBeenCalled();
  });

  it('createAppeal rejects foreign evidence before writing anything', async () => {
    const { s, hasura } = setup({ item: rejectedItem({ id: ITEM }) });
    expect(await codeOf(() => s.createAppeal(BIZ, 'u1', ITEM, { reason: REASON, evidenceKeys: ['https://evil.example/x.jpg'] }))).toBe(
      'ITEM_APPEAL_EVIDENCE_URL_INVALID'
    );
    expect(hasura.executeMutation).not.toHaveBeenCalled();
  });
});

describe('appeal evidence is only ever served as short-lived presigned GETs', () => {
  const KEYS = [evKey(), evKey(OTHER_ITEM, 'png')];
  const expectPresigned = (ev: any[], aws: any) => {
    expect(ev.map((e) => e.key)).toEqual(KEYS);
    for (const e of ev) {
      expect(e.url).toContain('X-Amz-Signature=');
      expect(e.url).toContain(`https://${PRIVATE_BUCKET}.`);
      expect(e.expiresAt).toBe('2026-11-01T12:15:00.000Z');
    }
    expect(aws.generatePresignedDownloadUrl.mock.calls.map((c: any[]) => c[0])).toEqual(
      KEYS.map((key) => ({ bucketName: PRIVATE_BUCKET, key, expiresIn: 900 }))
    );
  };

  it('business recovery view (owner)', async () => {
    const { s, aws } = setup({ item: rejectedItem({ id: ITEM, appeals: [pendingAppeal({ item_id: ITEM, evidence_keys: KEYS })] }) });
    const r = await s.getRecovery(BIZ, ITEM);
    expectPresigned(r.appeal!.evidence, aws);
    expect(JSON.stringify(r)).not.toContain('evidence_keys');
  });

  it('recovery view signs nothing for a non-owner (rejected before any signing)', async () => {
    const { s, aws } = setup({ item: rejectedItem({ id: ITEM, business_id: 'x', business: { id: 'x', user_id: 'x', name: 'X' }, appeals: [pendingAppeal({ item_id: ITEM, evidence_keys: KEYS })] }) });
    expect(await codeOf(s.getRecovery(BIZ, ITEM))).toBe('ITEM_APPEAL_NOT_OWNER');
    expect(aws.generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('admin queue and detail', async () => {
    const q = setup();
    q.hasura.executeQuery.mockImplementationOnce(async () => ({
      item_appeals: [pendingAppeal({ item_id: ITEM, evidence_keys: KEYS })],
      item_appeals_aggregate: { aggregate: { count: 1 } },
    }));
    expectPresigned((await q.s.listQueue({})).appeals[0].evidence, q.aws);
    const d = setup({ appeal: pendingAppeal({ item_id: ITEM, evidence_keys: KEYS }) });
    expectPresigned((await d.s.detail('a1', 'mod2')).appeal.evidence, d.aws);
  });

  it('a stored key that is not this item\'s evidence is never signed', async () => {
    const { s, aws } = setup({
      appeal: pendingAppeal({ item_id: ITEM, evidence_keys: [evKey(), evKey(FILE, 'jpg', OTHER_ITEM), `businesses/${OTHER_ITEM}/images/x.jpg`] }),
    });
    const out = await s.detail('a1', 'mod2');
    expect(out.appeal.evidence.map((e: any) => e.key)).toEqual([evKey()]);
    expect(aws.generatePresignedDownloadUrl).toHaveBeenCalledTimes(1);
  });
});

describe('AwsService.generateStrictUploadUrl (real SDK signer, offline)', () => {
  it('signs content-type and content-length so S3 refuses a different type or size', async () => {
    const { AwsService } = require('../aws/aws.service');
    const svc = new AwsService({ get: () => ({ region: 'ca-central-1', accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'test-only' }) } as any);
    const out = await svc.generateStrictUploadUrl({ bucketName: 'rs-bucket', key: evKey(FILE, 'png'), contentType: 'image/png', contentLength: 2048 });
    expect(out.signedHeaders).toEqual(expect.arrayContaining(['content-type', 'content-length', 'host']));
    expect(new URL(out.url).searchParams.get('X-Amz-Expires')).toBe('600');
    await expect(svc.generateStrictUploadUrl({ bucketName: 'b', key: 'k', contentType: 'image/png', contentLength: 0 })).rejects.toThrow();
  });
});
