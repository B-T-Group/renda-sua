export type ProfileSessionGate = 'wait' | 'fetch' | 'clear';

/** Cookie hydrate looks logged-out; do not clear stored persona until session is ready. */
export function profileSessionGate(
  auth0Loading: boolean,
  sessionReady: boolean,
  authenticated: boolean
): ProfileSessionGate {
  if (auth0Loading || !sessionReady) return 'wait';
  return authenticated ? 'fetch' : 'clear';
}
