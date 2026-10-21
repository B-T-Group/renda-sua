/**
 * #641 QA N1/N2: every agent-side 404 (non-uuid id, unknown posting, posting not
 * visible to the agent, flag off) has this one body, so nothing tells a missing
 * posting from a hidden one or from the feature being off. Same text as
 * `requireEnabled`'s flag-off 404.
 */
export const DEDICATED_NOT_FOUND_MESSAGE = 'Not found';

/** Any hyphenated hex uuid (what Hasura's uuid scalar accepts); other ids 404 before reaching Hasura (#641 QA N1). */
export function isUuidLike(value: string | null | undefined): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value?.trim() ?? '');
}
