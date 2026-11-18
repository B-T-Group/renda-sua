import React from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { theme } from '../../apps/frontend/src/theme/theme';
import {
  BusinessDeclineBanner,
  ConditionPhotoLightbox,
  ConditionPhotoStrip,
  DeclineAdminTable,
  DeclineConditionSheet,
  DeclineInsightsStat,
  DeclineOutcomeCard,
  DeclinePushCopy,
  DeclineReviewScreen,
} from '../../apps/frontend/src/components/rentals/DeclinePickupScreens';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import { ADMIN_ROWS, CARD, MOMO_PAID, MOMO_UNPAID, PHOTOS, sceneName } from './fixtures';

const boot = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function CaptureApp() {
  const scene = sceneName();
  const momo = scene.includes('momo');
  const money = scene.includes('momo-paid') || scene.includes('refund') ? MOMO_PAID : momo ? MOMO_UNPAID : CARD;
  const photos = PHOTOS.map((photo) => ({ ...photo, capturedAt: momo ? '2026-11-14T10:00:00.000Z' : photo.capturedAt }));
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ background: '#FAF9F7', minHeight: '100vh', padding: 16 }}>
          {scene === 'review' ? <DeclineReviewScreen money={money} photos={photos} onDecline={() => undefined} /> : null}
          {scene === 'decline-card' || scene === 'decline-momo' || scene === 'decline-momo-paid' ? (
            <DeclineConditionSheet open money={money} onClose={() => undefined} onConfirm={() => undefined} />
          ) : null}
          {scene === 'cancelled-card' ? <DeclineOutcomeCard money={CARD} refundStatus="none" /> : null}
          {scene === 'cancelled-momo-refund' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="none" /> : null}
          {scene === 'business' ? (
            <BusinessDeclineBanner reason={boot === 'fr' ? 'Endommagé' : 'Damaged'} photos={photos} timeZone={money.timeZone} />
          ) : null}
          {scene === 'push' ? <DeclinePushCopy /> : null}
          {scene === 'listing' ? <ConditionPhotoStrip photos={photos} timeZone={money.timeZone} /> : null}
          {scene === 'lightbox' ? <ConditionPhotoLightbox photos={photos} index={0} timeZone={money.timeZone} onClose={() => undefined} /> : null}
          {scene === 'refund-progress' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refund_pending" /> : null}
          {scene === 'refunded' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refunded" /> : null}
          {scene === 'insights' ? <DeclineInsightsStat declines={2} pickups={11} /> : null}
          {scene === 'admin' ? <DeclineAdminTable rows={ADMIN_ROWS} timeZone="Africa/Douala" /> : null}
        </div>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
