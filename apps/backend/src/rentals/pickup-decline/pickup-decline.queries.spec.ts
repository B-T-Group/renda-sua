import { readFileSync } from 'fs';
import { buildSchema, parse, validate } from 'graphql';
import { join } from 'path';
import * as documents from './pickup-decline.queries';

/**
 * Checked-in Hasura-shaped snapshot. `_delete_elem` is an Int index.
 * `_delete_key` is a String. `_append` is jsonb. Every pickup-decline document is validated.
 */
const HASURA_SCHEMA = buildSchema(readFileSync(join(__dirname, 'pickup-decline.hasura-schema.graphql'), 'utf8'));

function problems(document: string): string[] {
  return validate(HASURA_SCHEMA, parse(document)).map((error) => error.message);
}

function graphqlDocuments(): Array<[string, string]> {
  return Object.entries(documents).filter((entry): entry is [string, string] => {
    return typeof entry[1] === 'string' && /^\s*(query|mutation)\b/m.test(entry[1]);
  });
}

describe('decline refund Hasura documents', () => {
  it('validates every pickup-decline document against the schema snapshot', () => {
    const docs = graphqlDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(30);
    const failed = docs.flatMap(([name, document]) => problems(document).map((problem) => `${name}: ${problem}`));
    expect(failed).toEqual([]);
  });

  it('rejects _delete_elem with a string, which real Hasura reports as String where Int is expected', () => {
    const release = documents.RELEASE_NOTICE;
    const invalid = release.replace('_delete_key', '_delete_elem');
    expect(problems(invalid).join(' ')).toMatch(/String.*Int|Int/i);
  });
});
