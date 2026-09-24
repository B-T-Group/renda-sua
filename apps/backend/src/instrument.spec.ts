import { isExpectedUnavailable } from './instrument';

describe('isExpectedUnavailable', () => {
  it('drops remapped Hasura and Redis unavailable messages', () => {
    expect(
      isExpectedUnavailable(
        new Error('Temporarily unable to reach the data service')
      )
    ).toBe(true);
    expect(
      isExpectedUnavailable(new Error('Temporarily unable to load user profile'))
    ).toBe(true);
    expect(
      isExpectedUnavailable(
        new Error('Temporarily unable to complete this request')
      )
    ).toBe(true);
  });

  it('keeps unexpected application errors', () => {
    expect(isExpectedUnavailable(new Error('Internal server error'))).toBe(
      false
    );
    expect(isExpectedUnavailable(undefined)).toBe(false);
  });
});
