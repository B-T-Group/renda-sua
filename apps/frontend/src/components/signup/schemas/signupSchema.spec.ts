import { personasSchema } from './signupSchema';

describe('personasSchema', () => {
  it('accepts exactly one persona', () => {
    expect(personasSchema.safeParse(['business']).success).toBe(true);
    expect(personasSchema.safeParse(['client']).success).toBe(true);
    expect(personasSchema.safeParse(['agent']).success).toBe(true);
  });

  it('rejects empty and multi-persona selections', () => {
    expect(personasSchema.safeParse([]).success).toBe(false);
    expect(personasSchema.safeParse(['client', 'business']).success).toBe(
      false
    );
  });

  it('rejects unknown persona ids', () => {
    expect(personasSchema.safeParse(['admin']).success).toBe(false);
  });
});
