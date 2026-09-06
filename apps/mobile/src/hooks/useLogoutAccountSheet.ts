import { useCallback, useState } from 'react';
import { useStore } from '../stores/RootStore';
import { agentDisplayName } from '../utils/agentProfileDisplay';

export function useLogoutAccountSheet() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const { auth } = useStore();

  const open = useCallback(() => setVisible(true), []);
  const dismiss = useCallback(() => setVisible(false), []);

  const keep = useCallback(async () => {
    setBusy(true);
    await auth.logout('keep');
    setBusy(false);
    setVisible(false);
  }, [auth]);

  const remove = useCallback(async () => {
    setBusy(true);
    await auth.logout('remove');
    setBusy(false);
    setVisible(false);
  }, [auth]);

  return {
    visible,
    busy,
    open,
    dismiss,
    keep,
    remove,
    displayName: auth.user ? agentDisplayName(auth.user) : undefined,
  };
}
