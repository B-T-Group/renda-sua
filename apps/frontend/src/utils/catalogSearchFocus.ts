/** True when the client Search tab lands on /items?focus=search. */
export function catalogSearchShouldFocus(search: string): boolean {
  const query = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(query).get('focus') === 'search';
}
