import { brandTokens } from '../../theme/brandTokens';

/**
 * Shared brand accents for the for-business landing. The business persona sits
 * in the Trust Coast Blue accent family, over deep-blue brand chrome.
 */
export const FB_ACCENT = brandTokens.cta.main;
export const FB_ACCENT_DARK = brandTokens.cta.dark;
export const FB_HERO_GRADIENT = `linear-gradient(135deg, ${brandTokens.text.primary} 0%, ${brandTokens.primary.dark} 40%, ${brandTokens.primary.main} 75%, ${brandTokens.primary.light} 100%)`;

export const SIGNUP_SELL = '/signup?intent=business_sell';
export const SIGNUP_RENT = '/signup?intent=business_rent';
