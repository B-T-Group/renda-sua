import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { View } from 'react-native';
import { PaperProvider, Text } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from '../../apps/mobile/src/contexts/ThemeContext';
import ClientInspectionScreen from '../../apps/mobile/src/screens/client/ClientInspectionScreen';
import RentalBookingDetailScreen from '../../apps/mobile/src/screens/client/RentalBookingDetailScreen';
import RentalRequestSubmittedScreen from '../../apps/mobile/src/screens/client/RentalRequestSubmittedScreen';
import BusinessRentalBookingDetailScreen from '../../apps/mobile/src/screens/business/BusinessRentalBookingDetailScreen';
import { ReportSentConfirmation } from '../../apps/mobile/src/components/rentals/inspection/ReportSentConfirmation';
import { RentalStartedConfirmation } from '../../apps/mobile/src/components/rentals/inspection/RentalStartedConfirmation';
import { formatConfirmationDue, formatConfirmationMoney } from '../../apps/mobile/src/utils/rentals/confirmationFormat';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';

const bootLang = new URLSearchParams(window.location.search).get('lang') === 'fr' ? 'fr' : 'en';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: bootLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function CaptureScreen() {
  const params = new URLSearchParams(window.location.search);
  const language = params.get('lang') === 'fr' ? 'fr' : 'en';
  const scene = params.get('scene') ?? 'review';
  (window as Window & { __scene?: string }).__scene = scene;
  document.documentElement.lang = language;
  if (i18n.language !== language) void i18n.changeLanguage(language);
  const direct = scene === 'reportSent' || scene === 'rentalStarted' || scene === 'momoStarted' || scene === 'push' || scene === 'clientPush';
  const submitted = scene === 'requestSubmitted';
  const inspection = scene === 'review' || scene === 'momo' || scene === 'conflict';
  const business = scene === 'waiting' || scene === 'handed' || scene === 'businessWait';
  return (
    <View style={{ flex: 1, minHeight: '100vh', backgroundColor: '#FAF9F7' }}>
      {direct ? (
        <DirectConfirmation scene={scene} language={language} />
      ) : submitted ? (
        <RentalRequestSubmittedScreen />
      ) : inspection ? (
        <ClientInspectionScreen />
      ) : business ? (
        <BusinessRentalBookingDetailScreen />
      ) : (
        <RentalBookingDetailScreen />
      )}
    </View>
  );
}

const PHOTOS = [
  { id: '1', role: 'overview', url: '/hero-jbl.png' },
  { id: '2', role: 'other_side', url: '/hero-jbl.png' },
  { id: '3', role: 'accessories', url: '/hero-jbl.png' },
];

function DirectConfirmation({ scene, language }: { scene: string; language: string }) {
  const { t } = useTranslation();
  const when = formatConfirmationDue('2026-11-17T15:32:00.000Z', 'America/Toronto', language);
  const due = formatConfirmationDue('2026-11-19T01:00:00.000Z', 'America/Toronto', language);
  const momoDue = formatConfirmationDue('2026-11-18T19:00:00.000Z', 'Africa/Douala', language);
  const zone = t('rentalInspection.confirm.zoneMontreal', 'Montréal time');
  const douala = t('rentalInspection.confirm.zoneDouala', 'Douala time');
  if (scene === 'reportSent') {
    return (
      <ReportSentConfirmation
        stage="pickup"
        renterName="Amina"
        unitCount={1}
        versionNo={1}
        when={when}
        photos={PHOTOS}
        canEdit
        onBack={() => undefined}
        onEdit={() => undefined}
      />
    );
  }
  if (scene === 'push' || scene === 'clientPush') return <StartedNotice language={language} due={due} zone={zone} kind={scene} />;
  return (
    <RentalStartedConfirmation
      momo={scene === 'momoStarted'}
      due={scene === 'momoStarted' ? momoDue : due}
      zone={scene === 'momoStarted' ? douala : zone}
      paid={formatConfirmationMoney(scene === 'momoStarted' ? 45000 : 45, scene === 'momoStarted' ? 'XAF' : 'CAD', language)}
      deposit={formatConfirmationMoney(scene === 'momoStarted' ? 10000 : 20, scene === 'momoStarted' ? 'XAF' : 'CAD', language)}
      depositHeld={scene !== 'momoStarted'}
      title="JBL PartyBox 310"
      startAt="2026-11-17T15:00:00.000Z"
      endAt={scene === 'momoStarted' ? '2026-11-18T19:00:00.000Z' : '2026-11-19T01:00:00.000Z'}
      location={scene === 'momoStarted' ? 'Sono Akwa – Akwa, Douala' : 'Atelier Nord, Toronto'}
      onBack={() => undefined}
    />
  );
}

function StartedNotice({ language, due, zone, kind }: { language: string; due: string; zone: string; kind: string }) {
  const french = language === 'fr';
  const when = `${due} (${zone})`;
  const startedTitle = french ? 'Location démarrée' : 'Rental started';
  const startedBody = kind === 'clientPush'
    ? french
      ? `Votre location de JBL PartyBox 310 a commencé. Le retour est dû le ${when}.`
      : `Your rental of JBL PartyBox 310 has started. Return is due by ${when}.`
    : french
      ? `Amina a accepté l'état des lieux. JBL PartyBox 310 est désormais en cours jusqu'au ${when}.`
      : `Amina accepted the condition report. JBL PartyBox 310 is now in progress until ${when}.`;
  return (
    <View style={{ padding: 20 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E6E1D8' }}>
        <Text variant="titleMedium" style={{ fontWeight: '800', fontFamily: 'Inter_600SemiBold' }}>{startedTitle}</Text>
        <Text variant="bodyMedium" style={{ marginTop: 6, fontFamily: 'Inter_400Regular' }}>{startedBody}</Text>
      </View>
    </View>
  );
}

function CaptureApp() {
  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider
        initialMetrics={{
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
          frame: { x: 0, y: 0, width: 390, height: 844 },
        }}
      >
        <ThemeProvider>
          <PaperProvider>
            <CaptureScreen />
          </PaperProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
flushSync(() => {
  root.render(<CaptureApp />);
});
