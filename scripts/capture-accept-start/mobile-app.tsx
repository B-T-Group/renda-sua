import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from '../../apps/mobile/src/contexts/ThemeContext';
import ClientInspectionScreen from '../../apps/mobile/src/screens/client/ClientInspectionScreen';
import RentalBookingDetailScreen from '../../apps/mobile/src/screens/client/RentalBookingDetailScreen';
import BusinessRentalBookingDetailScreen from '../../apps/mobile/src/screens/business/BusinessRentalBookingDetailScreen';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: 'en',
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
  const inspection = scene === 'review' || scene === 'momo' || scene === 'conflict';
  const business = scene === 'waiting' || scene === 'handed';
  return (
    <View style={{ flex: 1, minHeight: '100vh', backgroundColor: '#FAF9F7' }}>
      {inspection ? <ClientInspectionScreen /> : business ? <BusinessRentalBookingDetailScreen /> : <RentalBookingDetailScreen />}
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
