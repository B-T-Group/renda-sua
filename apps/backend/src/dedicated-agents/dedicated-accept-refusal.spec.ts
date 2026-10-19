import { ConflictException } from '@nestjs/common';
import { acceptCheckRefusal } from './dedicated-postings.service';

describe('acceptCheckRefusal (QA #613 N2/N3)', () => {
  const body = (e: ConflictException | null) => e?.getResponse() as Record<string, unknown> | undefined;

  it('maps a disabled slot to 409 slot_disabled', () => {
    const e = acceptCheckRefusal(new Error('dedicated_accept_slot_disabled: posting p has a slot the store turned off'));
    expect(e).toBeInstanceOf(ConflictException);
    expect(body(e)).toMatchObject({ code: 'slot_disabled' });
  });

  it.each(['not_verified', 'suspended', 'contract_unsigned'])('maps %s to 409 agent_ineligible with the reason', (r) => {
    const e = acceptCheckRefusal({ message: 'GraphQL error', response: { errors: [{ message: `dedicated_accept_agent_ineligible: ${r}` }] } });
    expect(e).toBeInstanceOf(ConflictException);
    expect(body(e)).toMatchObject({ code: 'agent_ineligible', reason: r });
  });

  it('leaves other errors alone', () => {
    expect(acceptCheckRefusal(new Error('connection reset'))).toBeNull();
    expect(acceptCheckRefusal(null)).toBeNull();
    expect(acceptCheckRefusal(new Error('dedicated_accept_agent_ineligible: banana'))).toBeNull();
  });
});
