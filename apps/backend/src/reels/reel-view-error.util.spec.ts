import { isMissingReelViewReference } from './reel-view-error.util';

describe('isMissingReelViewReference', () => {
  it('detects a missing reel_id foreign key', () => {
    const error = {
      message:
        'Foreign key violation. insert or update on table "reel_view_events" violates foreign key constraint "reel_view_events_reel_id_fkey"',
      response: {
        errors: [
          {
            message:
              'Foreign key violation. insert or update on table "reel_view_events" violates foreign key constraint "reel_view_events_reel_id_fkey"',
          },
        ],
      },
    };
    expect(isMissingReelViewReference(error)).toBe(true);
  });

  it('detects a missing user_id foreign key', () => {
    expect(
      isMissingReelViewReference({
        message:
          'violates foreign key constraint "reel_view_events_user_id_fkey"',
      })
    ).toBe(true);
  });

  it('ignores unrelated Hasura errors', () => {
    expect(
      isMissingReelViewReference({
        message: 'invalid input syntax for type uuid',
      })
    ).toBe(false);
  });
});
