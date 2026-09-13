/**
 * Signup OTP via Rendasua deferred-signup APIs (Nest).
 */

import Auth0DirectService, {
  type Auth0Response,
  type Auth0Tokens,
  type Auth0User,
} from './auth0DirectService';
import {
  postSignupResendOtp,
  postSignupVerifyOtp,
  type SignupLaunchPromo,
} from './publicAuthApi';
import { extractAuth0TokensFromLoginResponse } from './rendasuaLoginOtpService';

export type SignupVerifyResult =
  | {
      type: 'success';
      user: Auth0User;
      tokens: Auth0Tokens;
      launchPromo: SignupLaunchPromo | null;
    }
  | { type: 'error'; error: string };

export async function resendSignupOtp(
  attemptId: string,
  channel?: 'email' | 'sms'
): Promise<
  | {
      ok: true;
      channel?: 'email' | 'sms';
      availableChannels?: Array<'email' | 'sms'>;
      maskedEmail?: string;
      maskedPhone?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const data = await postSignupResendOtp(attemptId, channel);
    return {
      ok: true,
      channel: data.channel,
      availableChannels: data.availableChannels,
      maskedEmail: data.maskedEmail,
      maskedPhone: data.maskedPhone,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur réseau',
    };
  }
}

export async function verifySignupOtp(
  attemptId: string,
  otp: string
): Promise<SignupVerifyResult> {
  try {
    const data = await postSignupVerifyOtp({ attemptId, otp });
    const tokens = extractAuth0TokensFromLoginResponse(data);
    if (!tokens?.access_token) {
      return {
        type: 'error',
        error: 'Réponse serveur invalide (tokens manquants)',
      };
    }
    const finalized: Auth0Response =
      await Auth0DirectService.finalizeAuthWithTokens(tokens);
    if (finalized.type !== 'success' || !finalized.user || !finalized.tokens) {
      return {
        type: 'error',
        error:
          finalized.type === 'error'
            ? finalized.error
            : "Erreur d'authentification",
      };
    }
    return {
      type: 'success',
      user: finalized.user,
      tokens: finalized.tokens,
      launchPromo: data.launchPromo ?? null,
    };
  } catch (e) {
    return {
      type: 'error',
      error: e instanceof Error ? e.message : 'Code invalide',
    };
  }
}
