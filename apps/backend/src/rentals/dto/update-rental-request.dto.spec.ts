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

  it('still requires expectedVersion', async () => {
    const dto = plainToInstance(UpdateRentalRequestDto, {
      clientRequestNote: 'Call me before you leave',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('expectedVersion');
  });
});
