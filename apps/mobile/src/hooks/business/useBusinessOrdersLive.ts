import { gql } from '@apollo/client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getClient, terminateHasuraWebsocket } from '../../services/apolloClient';
import Auth0DirectService from '../../services/auth0DirectService';
import { useStore } from '../../stores/RootStore';
import {
  BUSINESS_LIVE_TERMINAL_STATUSES,
  BUSINESS_ORDERS_LIVE_DEBOUNCE_MS,
  businessOrdersLiveFingerprint,
  createLiveRefreshScheduler,
  type BusinessOrderLiveRow,
} from '../../utils/businessOrdersLive';
import { tokenAllowsHasuraRole } from '../../utils/jwtHasura';

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

function useBusinessRoleAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Auth0DirectService.getAccessToken()
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
  }, []);

  return allowed;
}

/** One Hasura subscription for the signed-in business owner. Delegates never mount this. */
export function useBusinessOrdersLive(): void {
  const { incomingOrder } = useStore();
  const allowed = useBusinessRoleAllowed();
  const bumpRef = useRef(incomingOrder.bumpLiveRevision);
  bumpRef.current = incomingOrder.bumpLiveRevision;

  useLayoutEffect(() => {
    if (allowed) terminateHasuraWebsocket();
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return undefined;
    const scheduler = createLiveRefreshScheduler(
      BUSINESS_ORDERS_LIVE_DEBOUNCE_MS,
      () => bumpRef.current()
    );
    const subscription = getClient()
      .subscribe<LiveSubscriptionData>({ query: BUSINESS_ORDERS_LIVE })
      .subscribe({
        next: ({ data }) => {
          scheduler.push(businessOrdersLiveFingerprint(data?.orders));
        },
        error: () => undefined,
      });
    return () => {
      scheduler.cancel();
      subscription.unsubscribe();
    };
  }, [allowed]);
}
