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
  /** D2: keep the floating WhatsApp bubble unmounted (orb route, or still deciding). */
  whatsappYieldsToOrb: boolean;
  headerEntry: HeaderAssistantEntry;
}

/**
 * Assistant entry points (#451 PR-6), behind `assistant_launcher_v1` for client and
 * guest. Flag off, the flags call failing, or the flags call taking longer than
 * `CLIENT_FLAGS_WAIT_MS` restores today's behaviour (WhatsApp bubble, SmartToy icon).
 */
export function useAssistantEntryGate({
  isAuthenticated,
  userType,
  personaLoading = false,
  pathname,
  isMobile,
}: {
  isAuthenticated: boolean;
  userType: string | null | undefined;
  /** Signed-in profile still loading (the persona may turn out to be client). */
  personaLoading?: boolean;
  pathname: string;
  isMobile: boolean;
}): AssistantEntryGate {
  // `loaded` is also true once the wait budget runs out, so a slow or failing
  // flags call can never keep WhatsApp away (it falls back to the defaults).
  const { flags, loaded } = useClientFlags();
  const inputs = {
    flagOn: flags.assistant_launcher_v1,
    isClientOrGuest: !isAuthenticated || userType === 'client',
    pathname,
    isMobile,
  };
  const personaPending = isAuthenticated && personaLoading && !userType;
  // Still deciding between the orb and today's entry points: hold both the bubble
  // and the header icon so neither flashes and then swaps for the orb. Agent and
  // business (persona known) are never held.
  const undecided =
    (inputs.isClientOrGuest || personaPending) &&
    (!loaded || (personaPending && inputs.flagOn));
  return {
    showLauncher: shouldShowAssistantLauncher(inputs),
    whatsappYieldsToOrb: undecided || orbReplacesWhatsApp(inputs),
    headerEntry: undecided ? 'pending' : headerAssistantEntry(inputs),
  };
}
