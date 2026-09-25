import { useAuth0 } from '@auth0/auth0-react';
import React, { useEffect, useRef } from 'react';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import { useClientFlags } from '../../hooks/useClientFlags';
import {
  SITE_EVENT_AUTH_SESSION_OBSERVED,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import { hasLegacyAuth0SpaSession } from '../../utils/authFunnelTracking';

const AuthSessionObservedTracker: React.FC = () => {
  const { isAuthenticated } = useSessionAuth();
  const { isAuthenticated: auth0Authenticated } = useAuth0();
  const { flags } = useClientFlags();
  const { trackSiteEvent } = useTrackSiteEvent();
  const sentRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || sentRef.current) return;
    sentRef.current = true;
    void trackSiteEvent({
      eventType: SITE_EVENT_AUTH_SESSION_OBSERVED,
      metadata: {
        context: 'session_load',
        platform: 'web',
        flag_on: flags.auth_web_inapp_gates ?? false,
        legacy_auth0_session_present:
          auth0Authenticated && hasLegacyAuth0SpaSession(),
      },
    });
  }, [
    auth0Authenticated,
    flags.auth_web_inapp_gates,
    isAuthenticated,
    trackSiteEvent,
  ]);

  return null;
};

export default AuthSessionObservedTracker;
