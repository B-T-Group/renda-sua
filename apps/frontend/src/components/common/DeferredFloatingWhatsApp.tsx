import { Box, CircularProgress } from '@mui/material';
import { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const FloatingWhatsApp = lazy(() =>
  import(
    /* webpackChunkName: "vendor-whatsapp-widget" */
    '@digicroz/react-floating-whatsapp'
  ).then((m) => ({ default: m.FloatingWhatsApp }))
);

export interface DeferredFloatingWhatsAppProps {
  whatsappBottomOffset: number;
  hidden: boolean;
}

export function DeferredFloatingWhatsApp({
  whatsappBottomOffset,
  hidden,
}: DeferredFloatingWhatsAppProps) {
  const { t } = useTranslation();
  const [mountWidget, setMountWidget] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout?: number }
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(() => setMountWidget(true), {
        timeout: 4000,
      });
    } else {
      timeoutId = window.setTimeout(() => setMountWidget(true), 2000);
    }
    return () => {
      if (idleId != null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [hidden]);

  if (hidden || !mountWidget) return null;

  return (
    <Suspense
      fallback={
        <Box
          sx={{
            position: 'fixed',
            bottom: whatsappBottomOffset,
            right: 24,
            zIndex: 1200,
          }}
        >
          <CircularProgress size={28} />
        </Box>
      }
    >
      <FloatingWhatsApp
        phoneNumber="237690043293"
        accountName={t('support.whatsapp.accountName', 'Rendasua Support')}
        statusMessage={t(
          'support.whatsapp.statusMessage',
          'Typically replies within 1 hour'
        )}
        chatMessage={t(
          'support.whatsapp.chatMessage',
          'Hello! How can we help you today?'
        )}
        placeholder={t('support.whatsapp.placeholder', 'Type a message...')}
        allowClickAway={true}
        allowEsc={true}
        notification={false}
        buttonStyle={{ bottom: `${whatsappBottomOffset}px`, right: '24px' }}
        darkMode={false}
      />
    </Suspense>
  );
}
