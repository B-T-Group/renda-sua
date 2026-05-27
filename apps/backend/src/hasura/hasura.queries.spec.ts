import { parse } from 'graphql';

jest.mock('graphql-request', () => ({
  gql: (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({ raw: strings }, ...values),
}));

describe('Hasura GraphQL queries', () => {
  it('are valid GraphQL documents', () => {
    const queries = require('./hasura.queries');

    for (const [name, query] of Object.entries(queries)) {
      if (typeof query === 'string') {
        try {
          parse(query);
        } catch (error: any) {
          throw new Error(`${name} is not valid GraphQL: ${error.message}`);
        }
      }
    }
  });
});
