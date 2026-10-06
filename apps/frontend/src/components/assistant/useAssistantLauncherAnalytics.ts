import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalAssistantChat } from '../../contexts/AssistantChatContext';
import {
  SiteEventTypeV1,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { readBootstrapCountryCode } from '../../utils/marketStorage';

/** Locale for event metadata: the #458 validator accepts `fr` / `en` only. */
export function eventLocale(language: string | undefined | null): 'fr' | 'en' {
  return (language || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

/**
 * Fire-and-forget launcher events (#451 §3.2/§3.3) with the common metadata
 * (`persona`, `market`, `locale`, `is_signed_in`). Only keys the #458 assistant
 * validators accept are sent. Guests are keyed by the chat thread id, never the
 * stable per-install id.
 */
export function useAssistantLauncherAnalytics(isSignedIn: boolean) {
  const { trackSiteEvent } = useTrackSiteEvent();
  const { i18n } = useTranslation();
  const chat = useOptionalAssistantChat();
  const threadId = chat?.threadId ?? '';
  const language = i18n?.language;

  return useCallback(
    (eventType: SiteEventTypeV1, metadata: Record<string, string>) => {
      const market = readBootstrapCountryCode();
      void trackSiteEvent(
        {
          eventType,
          metadata: {
            ...metadata,
            persona: isSignedIn ? 'client' : 'guest',
            locale: eventLocale(language),
            is_signed_in: isSignedIn,
            ...(market ? { market } : {}),
          },
        },
        { anonymousId: threadId || null }
      );
    },
    [trackSiteEvent, isSignedIn, language, threadId]
  );
}
