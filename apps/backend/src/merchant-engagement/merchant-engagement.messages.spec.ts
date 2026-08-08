import {
  buildEngagementPushMessage,
  buildWeeklyDigestHtml,
} from './merchant-engagement.messages';

describe('merchant-engagement.messages', () => {
  it('builds localized push copy with persona metadata', () => {
    const en = buildEngagementPushMessage('push_catalog_stalled', 'en');
    expect(en.title).toMatch(/Add products/i);
    expect(en.data).toEqual(
      expect.objectContaining({
        type: 'business_add_item',
        persona: 'business',
        pushId: 'push_catalog_stalled',
      })
    );

    const fr = buildEngagementPushMessage('push_catalog_stalled', 'fr-CM');
    expect(fr.title).toMatch(/Ajoutez/i);
  });

  it('escapes HTML in weekly digest business name and next step', () => {
    const digest = buildWeeklyDigestHtml({
      businessName: '<script>alert(1)</script>Shop',
      readinessPercent: 40,
      approvedCount: 2,
      catalogTarget: 10,
      totalProductViews: 3,
      nextStep: 'Add logo <img src=x onerror=1>',
      preferredLanguage: 'en',
    });

    expect(digest.subject).toContain('Store update —');
    expect(digest.subject).not.toMatch(/[<>]/);
    expect(digest.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;Shop');
    expect(digest.html).toContain(
      'Add logo &lt;img src=x onerror=1&gt;'
    );
    expect(digest.html).not.toContain('<script>');
  });
});
