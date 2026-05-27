import { parse } from 'graphql';
import * as queries from './hasura.queries';

describe('Hasura GraphQL queries', () => {
  it('are valid GraphQL documents', () => {
    for (const [name, query] of Object.entries(queries)) {
      if (typeof query === 'string') {
        expect(() => parse(query)).not.toThrow();
      }
    }
  });
});
