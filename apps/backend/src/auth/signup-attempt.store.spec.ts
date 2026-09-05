import { SignupAttemptStore } from './signup-attempt.store';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('SignupAttemptStore.claimForVerify', () => {
  it('claims only idle attempts and requires exactly one affected row', async () => {
    const executeMutation = jest.fn().mockResolvedValue({
      update_signup_attempts: {
        affected_rows: 1,
        returning: [{ id: 'attempt-1', status: 'verifying' }],
      },
    });
    const store = new SignupAttemptStore({
      executeMutation,
    } as unknown as HasuraSystemService);

    const claimed = await store.claimForVerify('attempt-1');

    expect(claimed?.id).toBe('attempt-1');
    const mutation = String(executeMutation.mock.calls[0][0]);
    expect(mutation).toContain('affected_rows');
    expect(mutation).toContain(
      'status: { _in: ["pending", "verified_pending_provision"] }'
    );
    expect(mutation).toContain('_set: { status: "verifying"');
    expect(mutation).not.toContain('"verifying", "verified_pending_provision"');
    expect(mutation).not.toContain('"pending", "verifying"');
  });

  it('returns null when another worker already claimed the attempt', async () => {
    const store = new SignupAttemptStore({
      executeMutation: jest.fn().mockResolvedValue({
        update_signup_attempts: { affected_rows: 0, returning: [] },
      }),
    } as unknown as HasuraSystemService);

    await expect(store.claimForVerify('attempt-1')).resolves.toBeNull();
  });
});
