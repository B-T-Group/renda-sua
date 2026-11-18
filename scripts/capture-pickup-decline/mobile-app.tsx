import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { PaperProvider } from 'react-native-paper';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';
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
} from '../../apps/mobile/src/components/rentals/DeclinePickupScreens';
import { ADMIN_ROWS, CARD, MOMO_PAID, MOMO_UNPAID, PHOTOS, sceneName } from './fixtures';

const boot = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function CaptureApp() {
  const scene = sceneName();
  const momo = scene.includes('momo') || scene.includes('refund');
  const money = scene.includes('momo-paid') || scene.includes('refund') ? MOMO_PAID : scene.includes('momo') ? MOMO_UNPAID : CARD;
  const photos = PHOTOS.map((photo) => ({ ...photo, capturedAt: momo ? '2026-11-14T10:00:00.000Z' : photo.capturedAt }));
  return (
    <I18nextProvider i18n={i18n}>
      <PaperProvider>
        <div style={{ background: '#FAF9F7', minHeight: '100vh' }}>
          {scene === 'review' ? <DeclineReviewScreen money={money} photos={photos} onDecline={() => undefined} /> : null}
          {scene === 'decline-card' || scene === 'decline-momo' || scene === 'decline-momo-paid' ? (
            <DeclineConditionSheet money={money} onClose={() => undefined} />
          ) : null}
          {scene === 'cancelled-card' ? <DeclineOutcomeCard money={CARD} refundStatus="none" /> : null}
          {scene === 'cancelled-momo' ? <DeclineOutcomeCard money={MOMO_UNPAID} refundStatus="none" /> : null}
          {scene === 'cancelled-momo-refund' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="none" /> : null}
          {scene === 'business' ? (
            <BusinessDeclineBanner reason={boot === 'fr' ? 'Endommagé' : 'Damaged'} photos={photos} timeZone="Africa/Douala" />
          ) : null}
          {scene === 'push' ? <DeclinePushCopy /> : null}
          {scene === 'listing' ? <ConditionPhotoStrip photos={photos} timeZone={momo ? 'Africa/Douala' : 'America/Toronto'} /> : null}
          {scene === 'lightbox' ? <ConditionPhotoLightbox photos={photos} timeZone={momo ? 'Africa/Douala' : 'America/Toronto'} /> : null}
          {scene === 'refund-progress' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refund_pending" /> : null}
          {scene === 'refunded' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refunded" /> : null}
          {scene === 'insights' ? <DeclineInsightsStat declines={2} pickups={11} /> : null}
          {scene === 'admin' ? <DeclineAdminTable rows={ADMIN_ROWS} timeZone="Africa/Douala" /> : null}
        </div>
      </PaperProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
