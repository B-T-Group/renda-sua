import { gql, useSubscription } from '@apollo/client';
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useSessionAuth } from '../contexts/SessionAuthContext';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import {
  BUSINESS_LIVE_TERMINAL_STATUSES,
  BUSINESS_ORDERS_LIVE_DEBOUNCE_MS,
  businessOrdersLiveFingerprint,
  createLiveRefreshScheduler,
  type BusinessOrderLiveRow,
} from '../utils/businessOrdersLive';
import { tokenAllowsHasuraRole } from '../utils/jwtHasura';
import { terminateHasuraWebsocket } from './useGraphQLSubscription';

const BusinessOrdersLiveContext = createContext(0);

const terminalStatusFilter = BUSINESS_LIVE_TERMINAL_STATUSES.map(
  (status) => `"${status}"`
).join(', ');

const BUSINESS_ORDERS_LIVE = gql`
  subscription BusinessOrdersLive {
    orders(
      where: { current_status: { _nin: [${terminalStatusFilter}] } }
    ) {
      id
      current_status
      payment_status
      updated_at
    }
  }
`;

interface LiveSubscriptionData {
  orders: BusinessOrderLiveRow[];
}

function useBusinessRoleAllowed(enabled: boolean): boolean {
  const { getAccessToken } = useSessionAuth();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setAllowed(false);
      return undefined;
    }
    let cancelled = false;
    void getAccessToken()
      .then((token) => {
        if (cancelled) return;
        setAllowed(!!token && tokenAllowsHasuraRole(token, 'business'));
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, getAccessToken]);

  return allowed;
}

function BusinessOrdersLiveSubscriber({
  onRevision,
}: {
  onRevision: () => void;
}) {
  const onRevisionRef = useRef(onRevision);
  const allowed = useBusinessRoleAllowed(true);
  const schedulerRef = useRef(
    createLiveRefreshScheduler(BUSINESS_ORDERS_LIVE_DEBOUNCE_MS, () => {
      onRevisionRef.current();
    })
  );

  useEffect(() => {
    onRevisionRef.current = onRevision;
  }, [onRevision]);

  useLayoutEffect(() => {
    if (allowed) terminateHasuraWebsocket();
  }, [allowed]);

  useEffect(() => () => schedulerRef.current.cancel(), []);

  useSubscription<LiveSubscriptionData>(BUSINESS_ORDERS_LIVE, {
    skip: !allowed,
    onData: ({ data }) => {
      const fingerprint = businessOrdersLiveFingerprint(data.data?.orders);
      schedulerRef.current.push(fingerprint);
    },
    onError: () => undefined,
  });

  return null;
}

export function BusinessOrdersLiveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useSessionAuth();
  const { userType, isDelegationContext } = useUserProfileContext();
  const [revision, setRevision] = useState(0);
  const enabled =
    isAuthenticated && userType === 'business' && !isDelegationContext;
  const bump = () => setRevision((current) => current + 1);

  return (
    <BusinessOrdersLiveContext.Provider value={revision}>
      {enabled ? <BusinessOrdersLiveSubscriber onRevision={bump} /> : null}
      {children}
    </BusinessOrdersLiveContext.Provider>
  );
}

export function useBusinessOrdersLiveRevision(): number {
  return useContext(BusinessOrdersLiveContext);
}
