/**
 * Params the Auth0 post-login Action reads as
 * `event.request.query.active_persona ?? event.request.body.active_persona`.
 * `extraParams` is expo-auth-session's name for react-native-auth0 `additionalParameters`.
 */

export function authorizeAdditionalParameters(
  audience: string,
  activePersona?: string
): Record<string, string> {
  const params: Record<string, string> = { audience };
  if (activePersona) params.active_persona = activePersona;
  return params;
}

export function tokenRequestBody(
  body: Record<string, string>,
  activePersona?: string
): Record<string, string> {
  if (!activePersona) return body;
  return { ...body, active_persona: activePersona };
}
