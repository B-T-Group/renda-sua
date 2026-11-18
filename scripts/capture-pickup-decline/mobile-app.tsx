import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Text, View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';
import { ThemeProvider, useTheme } from '../../apps/mobile/src/contexts/ThemeContext';
import { ListingConditionPhotos } from '../../apps/mobile/src/components/rentals/ListingConditionPhotos';
import BusinessInsightsScreen from '../../apps/mobile/src/screens/business/BusinessInsightsScreen';
import {
  BusinessDeclineBanner,
  ConditionPhotoLightbox,
  DeclineAdminTable,
  DeclineConditionSheet,
  DeclineOutcomeCard,
  DeclinePushCopy,
  DeclineReviewScreen,
} from '../../apps/mobile/src/components/rentals/DeclinePickupScreens';
import { ADMIN_ROWS, CARD, CARD_XAF, MOMO_NO_PHONE, MOMO_PAID, MOMO_UNPAID, OTHER_TEXT, PHOTOS, RENTER_NOTE, RENTER_NOTE_FR, RENTER_PHOTOS, sceneName, UNKNOWN_RAIL, WALLET_XAF } from './fixtures';

const boot = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
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
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 28, fontWeight: '700' }}>JBL PartyBox 310</Text>
      <Text>Atelier Nord, Toronto</Text>
      <View style={{ padding: 16, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>{t('rentals.detail.overview', 'About this rental')}</Text>
        <Text>Portable speaker for events.</Text>
        <ListingConditionPhotos listingId="listing-1" timeZone="America/Toronto" photos={photos} />
      </View>
    </View>
  );
}

function ThemedPaper({ children }: { children: React.ReactNode }) {
  const { paperTheme } = useTheme();
  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
}

function CaptureApp() {
  const scene = sceneName();
  const momo = scene.includes('momo') || scene.includes('refund');
  const money = scene.includes('momo-paid') || scene.includes('refund') ? MOMO_PAID : scene.includes('momo') ? MOMO_UNPAID : CARD;
  const photos = PHOTOS.map((photo) => ({ ...photo, capturedAt: momo ? '2026-11-14T10:00:00.000Z' : photo.capturedAt }));
  const sheet = scene.startsWith('decline');
  const note = boot === 'fr' ? RENTER_NOTE_FR : RENTER_NOTE;
  const body = (
    <div style={{ background: '#FAF9F7', minHeight: '100vh' }}>
      {scene === 'review' ? <DeclineReviewScreen money={money} photos={photos} onDecline={() => undefined} /> : null}
      {sheet ? <DeclineConditionSheet money={money} onClose={() => undefined} {...sheetExtras(scene)} /> : null}
      {scene === 'cancelled-card' ? <DeclineOutcomeCard money={CARD} refundStatus="none" /> : null}
      {scene === 'cancelled-momo' ? <DeclineOutcomeCard money={MOMO_UNPAID} refundStatus="none" /> : null}
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
          onViewBooking={() => undefined}
        />
      ) : null}
      {scene === 'push' ? <DeclinePushCopy /> : null}
      {scene === 'listing' ? <ListingFrame photos={photos} /> : null}
      {scene === 'lightbox' ? <ConditionPhotoLightbox photos={photos} timeZone="America/Toronto" /> : null}
      {scene === 'refund-progress' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refund_pending" /> : null}
      {scene === 'refunded' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="refunded" /> : null}
      {scene === 'refund-failed' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="failed" /> : null}
      {scene === 'refund-manual' ? <DeclineOutcomeCard money={MOMO_PAID} refundStatus="manual" /> : null}
      {scene === 'admin' ? <DeclineAdminTable rows={ADMIN_ROWS} timeZone="Africa/Douala" /> : null}
    </div>
  );
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <ThemedPaper>
          {scene === 'insights' ? (
            <SafeAreaProvider>
              <NavigationContainer>
                <BusinessInsightsScreen />
              </NavigationContainer>
            </SafeAreaProvider>
          ) : body}
        </ThemedPaper>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
