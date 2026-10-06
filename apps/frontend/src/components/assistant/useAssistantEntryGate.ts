import { useClientFlags } from '../../hooks/useClientFlags';
import {
  HeaderAssistantEntry,
  headerAssistantEntry,
  orbReplacesWhatsApp,
  shouldShowAssistantLauncher,
} from './assistantLauncherRoutes';

export interface AssistantEntryGate {
  /** Floating launcher may show (before transient suppressors such as the keyboard). */
  showLauncher: boolean;
  /** D2: keep the floating WhatsApp bubble unmounted (orb route, or flags still loading). */
  whatsappYieldsToOrb: boolean;
  headerEntry: HeaderAssistantEntry;
}

/**
 * Assistant entry points (#451 PR-6), behind `assistant_launcher_v1` for client and
 * guest. Flag off (or the flags call failing) restores today's behaviour exactly.
 */
export function useAssistantEntryGate({
  isAuthenticated,
  userType,
  pathname,
  isMobile,
}: {
  isAuthenticated: boolean;
  userType: string | null | undefined;
  pathname: string;
  isMobile: boolean;
}): AssistantEntryGate {
  const { flags, loaded } = useClientFlags();
  const inputs = {
    flagOn: flags.assistant_launcher_v1,
    isClientOrGuest: !isAuthenticated || userType === 'client',
    pathname,
    isMobile,
  };
  return {
    showLauncher: shouldShowAssistantLauncher(inputs),
    // Until flags load the bubble stays unmounted for client/guest, so it never
    // flashes and then swaps for the orb.
    whatsappYieldsToOrb: inputs.isClientOrGuest && (!loaded || orbReplacesWhatsApp(inputs)),
    headerEntry: headerAssistantEntry(inputs),
  };
}
