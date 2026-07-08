import { useCallback, useMemo, useState } from 'react';
import LoginMethodDialog from '../components/auth/LoginMethodDialog';

export function useLoginMethodDialog(returnTo?: string) {
  const [open, setOpen] = useState(false);
  const openLoginDialog = useCallback(() => setOpen(true), []);
  const closeLoginDialog = useCallback(() => setOpen(false), []);

  const loginMethodDialog = useMemo(
    () => (
      <LoginMethodDialog
        open={open}
        onClose={closeLoginDialog}
        returnTo={returnTo}
      />
    ),
    [open, closeLoginDialog, returnTo]
  );

  return { openLoginDialog, closeLoginDialog, loginMethodDialog };
}
