import React from 'react';
import { createRoot } from 'react-dom/client';
import { Container, CssBaseline, Paper, ThemeProvider, Typography } from '@mui/material';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { theme } from '../../apps/frontend/src/theme/theme';
import { BusinessCatalogHealthCard } from '../../apps/frontend/src/components/business/BusinessCatalogHealthCard';
import BusinessDashboardSection from '../../apps/frontend/src/components/business/BusinessDashboardSection';
import { ListingConditionPhotos } from '../../apps/frontend/src/components/rentals/ListingConditionPhotos';
import {
  BusinessDeclineBanner,
  ConditionPhotoLightbox,
  DeclineAdminTable,
  DeclineConditionSheet,
  DeclineInsightsStat,
  DeclineOutcomeCard,
  DeclinePushCopy,
  DeclineReviewScreen,
} from '../../apps/frontend/src/components/rentals/DeclinePickupScreens';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';
import { ADMIN_ROWS, CARD, CARD_XAF, MOMO_NO_PHONE, MOMO_PAID, MOMO_UNPAID, OTHER_TEXT, PHOTOS, RENTER_NOTE, RENTER_NOTE_FR, RENTER_PHOTOS, sceneName, UNKNOWN_RAIL, WALLET_XAF } from './fixtures';

const boot = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function sheetExtras(scene: string) {
  if (scene === 'decline-other') return { initialReason: 'other' as const };
  if (scene === 'decline-other-filled') return { initialReason: 'other' as const, initialText: OTHER_TEXT };
  if (scene === 'decline-photos') {
    return { initialPhotos: PHOTOS.slice(0, 2).map((photo) => ({ id: photo.slotKey, url: photo.url })) };
  }
  return {};
}

function ListingFrame({ photos }: { photos: typeof PHOTOS }) {
  const { t } = useTranslation();
  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <Typography variant="h4" fontWeight={700}>JBL PartyBox 310</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Atelier Nord, Toronto</Typography>
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('rentals.detail.overview', 'About this rental')}
        </Typography>
        <Typography color="text.secondary">Portable speaker for events.</Typography>
        <ListingConditionPhotos listingId="listing-1" timeZone="America/Toronto" photos={photos} />
      </Paper>
    </Container>
  );
}

function InsightsFrame() {
  const { t } = useTranslation();
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('business.dashboard.welcome', 'Welcome to your business dashboard')}
      </Typography>
      <BusinessDashboardSection title={t('business.insights.sections.performance', 'Performance')}>
        <DeclineInsightsStat declines={2} pickups={11} />
      </BusinessDashboardSection>
      <BusinessCatalogHealthCard
        health={{ approved: 4, target: 5, pendingCount: 1, rejectedCount: 0, outOfStockViewedCount: 0, primary: 'manage', isRental: true }}
        onPrimary={() => undefined}
      />
    </Container>
  );
}

function CaptureApp() {
  const scene = sceneName();
  const momo = scene.includes('momo');
  const money = scene.includes('momo-paid') || scene.includes('refund') ? MOMO_PAID : momo ? MOMO_UNPAID : CARD;
  const photos = PHOTOS.map((photo) => ({ ...photo, capturedAt: momo ? '2026-11-14T10:00:00.000Z' : photo.capturedAt }));
  const sheet = scene.startsWith('decline');
  const note = boot === 'fr' ? RENTER_NOTE_FR : RENTER_NOTE;
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ background: '#FAF9F7', minHeight: '100vh', padding: 16 }}>
          {scene === 'review' ? <DeclineReviewScreen money={money} photos={photos} onDecline={() => undefined} /> : null}
          {sheet ? (
            <DeclineConditionSheet open money={money} onClose={() => undefined} onConfirm={() => undefined} {...sheetExtras(scene)} />
          ) : null}
          {scene === 'cancelled-card' ? <DeclineOutcomeCard money={CARD} refundStatus="none" /> : null}
          {scene === 'cancelled-momo-refund' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="none" /> : null}
          {scene === 'xaf-wallet' ? <DeclineOutcomeCard money={WALLET_XAF} refundStatus="none" /> : null}
          {scene === 'xaf-card' ? <DeclineOutcomeCard money={CARD_XAF} refundStatus="none" /> : null}
          {scene === 'xaf-unpaid' ? <DeclineOutcomeCard money={MOMO_UNPAID} refundStatus="none" /> : null}
          {scene === 'refund-nophone' ? <DeclineOutcomeCard money={MOMO_NO_PHONE} refundStatus="none" /> : null}
          {scene === 'refunded-nophone' ? <DeclineOutcomeCard money={MOMO_NO_PHONE} refundStatus="refunded" /> : null}
          {scene === 'neutral' ? <DeclineOutcomeCard money={UNKNOWN_RAIL} refundStatus="none" /> : null}
          {scene === 'business' ? (
            <BusinessDeclineBanner
              reason="damaged"
              note={note}
              photos={RENTER_PHOTOS}
              baselinePhotos={photos}
              timeZone="America/Toronto"
              bookingHref="/rentals/bookings/RB-25496259"
            />
          ) : null}
          {scene === 'push' ? <DeclinePushCopy /> : null}
          {scene === 'listing' ? <ListingFrame photos={photos} /> : null}
          {scene === 'lightbox' ? <ConditionPhotoLightbox photos={photos} index={0} timeZone={money.timeZone} onClose={() => undefined} /> : null}
          {scene === 'refund-progress' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refund_pending" /> : null}
          {scene === 'refunded' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refunded" /> : null}
          {scene === 'refund-failed' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="failed" /> : null}
          {scene === 'refund-manual' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="manual" /> : null}
          {scene === 'insights' ? <InsightsFrame /> : null}
          {scene === 'admin' ? <DeclineAdminTable rows={ADMIN_ROWS} timeZone="Africa/Douala" /> : null}
        </div>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
