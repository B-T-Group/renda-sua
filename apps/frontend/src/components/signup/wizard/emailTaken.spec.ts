import { isEmailTakenByOtherAccount } from './emailTaken';

describe('isEmailTakenByOtherAccount', () => {
  it('is false when the email is not taken', () => {
    expect(isEmailTakenByOtherAccount(false, 'ada@example.com', null)).toBe(
      false
    );
  });

  it('is true when taken and this signup has no pending email yet', () => {
    expect(isEmailTakenByOtherAccount(true, 'ada@example.com', null)).toBe(
      true
    );
    expect(isEmailTakenByOtherAccount(true, 'ada@example.com', '')).toBe(true);
  });

  it('is false when the taken email is this signup’s own pending address', () => {
    expect(
      isEmailTakenByOtherAccount(true, '  Ada@Example.com ', 'ada@example.com')
    ).toBe(false);
  });

  it('is true when the user changed to a different taken email', () => {
    expect(
      isEmailTakenByOtherAccount(
        true,
        'other@example.com',
        'ada@example.com'
      )
    ).toBe(true);
  });
});
