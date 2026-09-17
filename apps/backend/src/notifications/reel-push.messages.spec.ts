import {
  buildReelAutoSponsoredLivePush,
  buildReelModerationApprovedPush,
} from './reel-push.messages';

describe('reel push messages', () => {
  it('builds auto-sponsored live copy in English and French', () => {
    expect(buildReelAutoSponsoredLivePush({})).toEqual({
      title: 'We created an ad for you',
      body: expect.stringContaining('sponsored reel'),
    });
    expect(buildReelAutoSponsoredLivePush({ preferredLanguage: 'fr' })).toEqual(
      {
        title: 'Nous avons créé une pub pour vous',
        body: expect.stringContaining('reel sponsorisé'),
      }
    );
  });

  it('keeps generic live copy distinct', () => {
    expect(buildReelModerationApprovedPush({}).title).toBe('Your reel is live');
  });
});
