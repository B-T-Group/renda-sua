import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { View, Text as RNText } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { paperTheme } from '../../apps/mobile/src/theme/paperTheme';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ThemeProvider } from '../../apps/mobile/src/contexts/ThemeContext';
import { setRuntimeEnv } from '../../apps/mobile/src/config/envSwitch';
import { NonProdEnvBanner } from '../../apps/mobile/src/components/common/NonProdEnvBanner';
import RentalBookingDetailScreen from '../../apps/mobile/src/screens/client/RentalBookingDetailScreen';
import BusinessRentalBookingDetailScreen from '../../apps/mobile/src/screens/business/BusinessRentalBookingDetailScreen';
import ClientMyRentalsScreen from '../../apps/mobile/src/screens/client/ClientMyRentalsScreen';
import en from '../../apps/mobile/src/i18n/locales/en.json';
import fr from '../../apps/mobile/src/i18n/locales/fr.json';

const params = new URLSearchParams(window.location.search);
const frozen = params.get('now');
if (frozen) {
  const fixed = new Date(frozen).getTime();
  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...args: ConstructorParameters<typeof RealDate>) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  } as DateConstructor;
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: params.get('lang') === 'fr' ? 'fr' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

setRuntimeEnv('dev');

function Header({ title, back }: { title: string; back: string }) {
  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, backgroundColor: '#fff' }}>
      <RNText style={{ width: 110, color: '#111' }}>{`‹ ${back}`}</RNText>
      <RNText style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 }}>{title}</RNText>
      <RNText accessibilityLabel="Settings" style={{ width: 48, textAlign: 'center', fontSize: 20 }}>⚙</RNText>
    </View>
  );
}

function BeforeBadge() {
  return (
    <View style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 20 }} pointerEvents="none">
      <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.72)', borderRadius: 99, paddingHorizontal: 6 }}>
        <RNText style={{ fontSize: 9, fontWeight: '700' }}>D</RNText>
      </View>
    </View>
  );
}

function CaptureScreen() {
  const view = params.get('view') ?? 'renter';
  const language = params.get('lang') === 'fr' ? 'fr' : 'en';
  (window as Window & { __scene?: string }).__scene = view === 'business' ? 'waiting' : 'started';
  if (i18n.language !== language) void i18n.changeLanguage(language);
  const french = language === 'fr';
  return (
    <View style={{ flex: 1, minHeight: '100vh', backgroundColor: '#FAF9F7' }}>
      {view === 'badge-before' ? <BeforeBadge /> : view === 'badge-after' ? <NonProdEnvBanner /> : null}
      {view === 'list' ? null : (
        <Header
          title={view === 'business' ? (french ? 'Réservation' : 'Booking') : french ? 'Locations' : 'Rentals'}
          back={view === 'business' ? (french ? 'Locations' : 'Rentals') : french ? 'Mes locations' : 'My rentals'}
        />
      )}
      {view === 'business' ? (
        <BusinessRentalBookingDetailScreen />
      ) : view === 'list' ? (
        <ClientMyRentalsScreen />
      ) : view === 'badge-before' || view === 'badge-after' ? (
        <RentalBookingDetailScreen />
      ) : (
        <RentalBookingDetailScreen />
      )}
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
          <PaperProvider theme={paperTheme}>
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
