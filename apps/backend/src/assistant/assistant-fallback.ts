import type { AssistantLocale } from './assistant.types';

export const TECHNICAL_FAILURE: Record<AssistantLocale, string> = {
  en: 'We are escalating this to our technical team for investigation. We will get back to you shortly.',
  fr: 'Nous transmettons ce problème à notre équipe technique pour vérification. Nous reviendrons vers vous sous peu.',
};

export const GET_BACK_SHORTLY: Record<AssistantLocale, string> = {
  en: 'Thank you for your message. We do not have the answer yet, but we will get back to you shortly.',
  fr: 'Merci pour votre message. Nous n’avons pas encore la réponse, mais nous reviendrons vers vous sous peu.',
};
