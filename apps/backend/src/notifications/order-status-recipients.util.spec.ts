import { excludeActorFromOrderStatusRecipients } from './order-status-recipients.util';

describe('excludeActorFromOrderStatusRecipients', () => {
  const recipients = [
    { email: 'a@x.com', type: 'client', userId: 'user-client' },
    { email: 'b@x.com', type: 'business', userId: 'user-biz' },
    { email: 'c@x.com', type: 'agent', userId: 'user-agent' },
  ];

  it('returns all recipients when actorUserId is absent', () => {
    expect(excludeActorFromOrderStatusRecipients(recipients, undefined)).toEqual(
      recipients
    );
    expect(excludeActorFromOrderStatusRecipients(recipients, null)).toEqual(
      recipients
    );
    expect(excludeActorFromOrderStatusRecipients(recipients, '')).toEqual(
      recipients
    );
    expect(excludeActorFromOrderStatusRecipients(recipients, '   ')).toEqual(
      recipients
    );
  });

  it('removes the recipient whose userId matches actorUserId', () => {
    expect(
      excludeActorFromOrderStatusRecipients(recipients, 'user-agent')
    ).toEqual([
      { email: 'a@x.com', type: 'client', userId: 'user-client' },
      { email: 'b@x.com', type: 'business', userId: 'user-biz' },
    ]);
  });

  it('keeps recipients without userId when actor is set', () => {
    const mixed = [
      { email: 'a@x.com', type: 'client', userId: 'u1' },
      { email: 'orphan@x.com', type: 'business' },
    ];
    expect(excludeActorFromOrderStatusRecipients(mixed, 'u1')).toEqual([
      { email: 'orphan@x.com', type: 'business' },
    ]);
  });
});
