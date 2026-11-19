import { buildClientSchema, getIntrospectionQuery, parse, validate } from 'graphql';
import * as documents from './pickup-decline.queries';

const url = process.env.HASURA_GRAPHQL_URL;
const live = url ? it : it.skip;

function graphqlDocuments(): string[] {
  return Object.values(documents).filter((value): value is string => {
    return typeof value === 'string' && /^\s*(query|mutation)\b/m.test(value);
  });
}

describe('decline refund documents against Hasura', () => {
  live('validates every pickup-decline document against the applied schema', async () => {
    const response = await fetch(url as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-hasura-admin-secret': process.env.HASURA_GRAPHQL_ADMIN_SECRET ?? '',
      },
      body: JSON.stringify({ query: getIntrospectionQuery() }),
    });
    const body = (await response.json()) as { data?: unknown; errors?: unknown };
    expect(response.ok).toBe(true);
    expect(body.errors).toBeUndefined();
    const schema = buildClientSchema(body.data as never);
    const failed = graphqlDocuments().flatMap((document) => validate(schema, parse(document)).map((error) => error.message));
    expect(failed).toEqual([]);
  });
});
