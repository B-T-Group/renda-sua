import { ReelCommentsService } from './reel-comments.service';

describe('ReelCommentsService', () => {
  const service = new ReelCommentsService({} as never);

  it('strips contact info from comments', () => {
    const body = 'Call me at +237 699 000 000 or email test@example.com';
    expect(service.stripContactInfo(body)).not.toMatch(/699|example\.com/i);
  });
});
