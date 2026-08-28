import {
  CLIENT_BUYER_PERSONAS_QUERY,
  CREDITS_SUMMARY_QUERY,
  USERS_AGENT_BUSINESS_SELECTION,
} from './user-persona-graphql';

describe('user persona GraphQL selections', () => {
  const queries = [
    USERS_AGENT_BUSINESS_SELECTION,
    CREDITS_SUMMARY_QUERY,
    CLIENT_BUYER_PERSONAS_QUERY,
  ];

  it('uses users.agent and users.business object relations', () => {
    for (const query of queries) {
      expect(query).toContain('agent { id }');
      expect(query).toContain('business { id }');
      expect(query).not.toMatch(/\bagents\s*\(/);
      expect(query).not.toMatch(/\bbusinesses\s*\(/);
    }
  });
});
