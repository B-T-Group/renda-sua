/**
 * Login OTP via Rendasua API (Nest) — pas d’appel Auth0 passwordless côté client.
 * @see https://dev.api.rendasua.com/api/docs#/auth/LoginController_startOtp
 * @see https://dev.api.rendasua.com/api/docs#/auth/LoginController_verifyOtp
 */

import { getEnv } from '../config/auth0';
import Auth0DirectService, { type Auth0Response, type Auth0Tokens } from './auth0DirectService';

const START_OTP_PATH = '/auth/login/start-otp';
const OTP_OPTIONS_PATH = '/auth/login/otp-options';
const VERIFY_OTP_PATH = '/auth/login/verify-otp';

export type LoginOtpChannel = 'email' | 'sms';

export type LoginOtpOptions = {
  defaultChannel: LoginOtpChannel;
  availableChannels: LoginOtpChannel[];
  maskedEmail?: string;
  maskedPhone?: string;
};

export type LoginOtpStartResult = LoginOtpOptions & {
  channel: LoginOtpChannel;
};

function apiBase(): string {
  const base = getEnv().apiUrl ?? 'https://prod.api.rendasua.com/api';
  return base.replace(/\/$/, '');
}

function parseApiError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.error === 'string' && o.error.length > 0) return o.error;
    if (typeof o.message === 'string' && o.message.length > 0) return o.message;
  }
  return fallback;
}

async function postJson(
  path: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      return { ok: false, error: parseApiError(data, res.statusText || 'Request failed') };
    }
    const o = data as { success?: boolean; error?: string };
    if (o && typeof o === 'object' && o.success === false) {
      return { ok: false, error: o.error || 'Request failed' };
    }
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Erreur réseau',
    };
  }
}

function parseOtpMeta(data: unknown): LoginOtpOptions {
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const channels = Array.isArray(o.availableChannels)
    ? o.availableChannels.filter(
        (c): c is LoginOtpChannel => c === 'email' || c === 'sms'
      )
    : [];
  const defaultChannel =
    o.defaultChannel === 'sms' || o.defaultChannel === 'email'
      ? o.defaultChannel
      : channels[0] || 'email';
  return {
    defaultChannel,
    availableChannels: channels.length ? channels : [defaultChannel],
    maskedEmail: typeof o.maskedEmail === 'string' ? o.maskedEmail : undefined,
    maskedPhone: typeof o.maskedPhone === 'string' ? o.maskedPhone : undefined,
  };
}

/** Extrait un bloc tokens style Auth0 depuis la réponse Nest (recherche en profondeur). */
export function extractAuth0TokensFromLoginResponse(data: unknown): Auth0Tokens | null {
  if (!data || typeof data !== 'object') return null;

  const tryShape = (obj: Record<string, unknown>): Auth0Tokens | null => {
    if (typeof obj.access_token !== 'string') return null;
    const expiresRaw = obj.expires_in;
    const expiresIn =
      typeof expiresRaw === 'number' && Number.isFinite(expiresRaw)
        ? expiresRaw
        : typeof expiresRaw === 'string'
          ? parseInt(expiresRaw, 10)
          : 3600;
    return {
      access_token: obj.access_token,
      refresh_token: typeof obj.refresh_token === 'string' ? obj.refresh_token : undefined,
      expires_in: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
      token_type: typeof obj.token_type === 'string' ? obj.token_type : 'Bearer',
      scope: typeof obj.scope === 'string' ? obj.scope : '',
    };
  };

  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    const hit = tryShape(cur as Record<string, unknown>);
    if (hit) return hit;
    for (const v of Object.values(cur as Record<string, unknown>)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) stack.push(v);
    }
  }
  return null;
}

export async function fetchLoginOtpOptions(
  contact: { email?: string; phone_number?: string }
): Promise<{ ok: true; options: LoginOtpOptions } | { ok: false; error: string }> {
  const result = await postJson(OTP_OPTIONS_PATH, contact);
  if (!result.ok) return result;
  return { ok: true, options: parseOtpMeta(result.data) };
}

export async function startLoginOtp(
  contact: { email?: string; phone_number?: string },
  channel?: LoginOtpChannel
): Promise<{ ok: true; result: LoginOtpStartResult } | { ok: false; error: string }> {
  const result = await postJson(START_OTP_PATH, {
    ...contact,
    ...(channel ? { channel } : {}),
  });
  if (!result.ok) return result;
  const meta = parseOtpMeta(result.data);
  const o = result.data as { channel?: LoginOtpChannel };
  return {
    ok: true,
    result: {
      ...meta,
      channel:
        o.channel === 'email' || o.channel === 'sms'
          ? o.channel
          : channel || meta.defaultChannel,
    },
  };
}

export async function startLoginOtpEmail(
  email: string,
  channel?: LoginOtpChannel
): Promise<{ ok: true; result?: LoginOtpStartResult } | { ok: false; error: string }> {
  const r = await startLoginOtp({ email }, channel);
  if (!r.ok) return r;
  return { ok: true, result: r.result };
}

export async function startLoginOtpSms(
  phoneE164: string,
  channel?: LoginOtpChannel
): Promise<{ ok: true; result?: LoginOtpStartResult } | { ok: false; error: string }> {
  const r = await startLoginOtp({ phone_number: phoneE164 }, channel);
  if (!r.ok) return r;
  return { ok: true, result: r.result };
}

async function verifyLoginOtp(
  contact: { email?: string; phone_number?: string },
  otp: string,
  channel?: LoginOtpChannel
): Promise<Auth0Response> {
  try {
    const res = await fetch(`${apiBase()}${VERIFY_OTP_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...contact, otp, ...(channel ? { channel } : {}) }),
    });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) {
      return {
        type: 'error',
        error: parseApiError(data, res.statusText || 'Code invalide'),
      };
    }

    const tokens = extractAuth0TokensFromLoginResponse(data);
    if (!tokens?.access_token) {
      return {
        type: 'error',
        error: 'Réponse serveur invalide (tokens manquants)',
      };
    }

    return Auth0DirectService.finalizeAuthWithTokens(tokens);
  } catch (e) {
    return {
      type: 'error',
      error: e instanceof Error ? e.message : 'Erreur réseau',
    };
  }
}

export async function verifyLoginOtpEmail(
  email: string,
  otp: string,
  channel?: LoginOtpChannel
): Promise<Auth0Response> {
  return verifyLoginOtp({ email }, otp, channel);
}

export async function verifyLoginOtpSms(
  phoneE164: string,
  otp: string,
  channel?: LoginOtpChannel
): Promise<Auth0Response> {
  return verifyLoginOtp({ phone_number: phoneE164 }, otp, channel);
}
