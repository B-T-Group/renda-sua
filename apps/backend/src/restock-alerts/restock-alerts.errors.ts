import { isMissingRestockGraphqlSchema } from '../hasura/hasura-request.util';

/** Hasura has not tracked restock_* yet (or the role cannot see them). */
export class RestockSchemaUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Restock alerts schema is not available', { cause });
    this.name = 'RestockSchemaUnavailableError';
  }
}

export function isRestockSchemaUnavailable(error: unknown): boolean {
  return (
    error instanceof RestockSchemaUnavailableError ||
    isMissingRestockGraphqlSchema(error)
  );
}
