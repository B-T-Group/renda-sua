import { ConflictException } from '@nestjs/common';
import {
  DEDICATED_ASSIGNMENT_CONFLICTS,
  isAssignmentCapError,
  isAssignmentDuplicateError,
  mapAssignmentWriteError,
  runAssignmentWrite,
} from './dedicated-assignment-write.util';

const capError = () =>
  Object.assign(new Error('Check constraint violation. dedicated_agent_assignment_cap_exceeded: agent x already has 3 live assignments (max 3)'), {
    response: { errors: [{ message: 'Check constraint violation.' }] },
  });
const dupError = () =>
  new Error('Uniqueness violation. duplicate key value violates unique constraint "dedicated_agent_assignments_live_unique_idx"');
const deadlock = () =>
  Object.assign(new Error('database query error'), {
    response: { errors: [{ message: 'database query error', extensions: { internal: { error: { status_code: '40P01' } } } }] },
  });

describe('dedicated assignment writes', () => {
  it('classifies the cap trigger and the live-unique index (message or response payload)', () => {
    expect(isAssignmentCapError(capError())).toBe(true);
    expect(
      isAssignmentCapError({ message: 'x', response: { errors: [{ message: 'dedicated_agent_assignment_cap_exceeded: agent' }] } })
    ).toBe(true);
    expect(isAssignmentCapError(dupError())).toBe(false);
    expect(isAssignmentDuplicateError(dupError())).toBe(true);
    expect(isAssignmentDuplicateError(capError())).toBe(false);
    expect(isAssignmentDuplicateError(new Error('boom'))).toBe(false);
  });

  it('maps cap and duplicate to 409 with stable codes, leaves others alone', () => {
    const cap = mapAssignmentWriteError(capError()) as ConflictException;
    expect(cap).toBeInstanceOf(ConflictException);
    expect(cap.getResponse()).toMatchObject({ code: DEDICATED_ASSIGNMENT_CONFLICTS.capExceeded });
    const dup = mapAssignmentWriteError(dupError()) as ConflictException;
    expect(dup.getResponse()).toMatchObject({ code: DEDICATED_ASSIGNMENT_CONFLICTS.duplicate });
    const other = new Error('boom');
    expect(mapAssignmentWriteError(other)).toBe(other);
  });

  it('retries 40P01 up to 3 attempts, then rethrows', async () => {
    const write = jest.fn().mockRejectedValueOnce(deadlock()).mockRejectedValueOnce(deadlock()).mockResolvedValue('ok');
    await expect(runAssignmentWrite(write, { backoffMs: 0 })).resolves.toBe('ok');
    expect(write).toHaveBeenCalledTimes(3);

    const always = jest.fn().mockRejectedValue(deadlock());
    await expect(runAssignmentWrite(always, { backoffMs: 0 })).rejects.toThrow('database query error');
    expect(always).toHaveBeenCalledTimes(3);
  });

  it('does not retry a cap / duplicate / other error', async () => {
    for (const make of [capError, dupError, () => new Error('boom')]) {
      const write = jest.fn().mockRejectedValue(make());
      await expect(runAssignmentWrite(write, { backoffMs: 0 })).rejects.toBeDefined();
      expect(write).toHaveBeenCalledTimes(1);
    }
    const write = jest.fn().mockRejectedValue(capError());
    await expect(runAssignmentWrite(write, { backoffMs: 0 })).rejects.toBeInstanceOf(ConflictException);
  });
});
