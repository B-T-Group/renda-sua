import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRentalRequestDto } from './update-rental-request.dto';

describe('UpdateRentalRequestDto', () => {
  it('accepts a notes-only edit without dates', async () => {
    const dto = plainToInstance(UpdateRentalRequestDto, {
      expectedVersion: 1,
      clientRequestNote: 'Call me before you leave',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('coerces a numeric-string version and keeps the note', async () => {
    const dto = plainToInstance(UpdateRentalRequestDto, {
      expectedVersion: '3',
      clientRequestNote: 'Call me before you leave',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.expectedVersion).toBe(3);
  });

  it('rejects a zero version, a zero quantity, and a note past 2000 characters', async () => {
    const dto = plainToInstance(UpdateRentalRequestDto, {
      expectedVersion: 0,
      unitsRequested: 0,
      clientRequestNote: 'x'.repeat(2001),
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'clientRequestNote',
      'expectedVersion',
      'unitsRequested',
    ]);
  });

  it('still requires expectedVersion', async () => {
    const dto = plainToInstance(UpdateRentalRequestDto, {
      clientRequestNote: 'Call me before you leave',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('expectedVersion');
  });
});
