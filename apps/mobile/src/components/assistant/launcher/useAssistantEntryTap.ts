import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useClientFlags } from '../../../contexts/ClientFlagsContext';
import { currentRouteName } from './launcherHooks';
import { useStore } from '../../../stores/RootStore';
import { assistantViewer } from '../../../utils/assistantLauncher';
import {
  trackLauncherTap,
  type LauncherEntry,
  type LauncherVariant,
} from '../../../services/analytics/assistantLauncherAnalytics';

/**
 * `assistant.launcher.tap` for the non-orb entry points (header button, menu
 * row). Only sends for client / guest with `assistant_launcher_v1` on.
 */
export function useAssistantEntryTap(): (variant: LauncherVariant | undefined, entry: LauncherEntry) => void {
  const { flags } = useClientFlags();
  const { i18n } = useTranslation();
  const { auth, persona, market, assistant } = useStore();
  const flagOn = flags.assistant_launcher_v1;
  return useCallback(
    (variant, entry) => {
      if (!flagOn) return;
      const viewer = assistantViewer(auth.isAuthenticated, persona.activePersona);
      if (viewer !== 'client' && viewer !== 'guest') return;
      const screen = currentRouteName();
      trackLauncherTap(
        {
          persona: viewer,
          screen: screen ?? 'unknown',
          market: market.selectedCountryCode,
          language: i18n.language,
          threadId: assistant.threadId,
        },
        variant,
        entry
      );
    },
    [flagOn, auth, persona, market, assistant, i18n]
  );
}
