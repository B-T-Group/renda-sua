import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { theme } from '../../apps/frontend/src/theme/theme';
import { DeclineExclusionPanel } from '../../apps/frontend/src/components/rentals/DeclineExclusionPanel';
import en from '../../apps/frontend/public/locales/en.json';
import fr from '../../apps/frontend/public/locales/fr.json';

const params = new URLSearchParams(window.location.search);
const boot = params.get('lang') === 'fr' ? 'fr' : 'en';
const excluded = params.get('scene') === 'on';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: boot,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

const row = {
  id: 'decline-1',
  bookingId: 'booking-1',
  bookingNumber: 'RB-25496259',
  businessName: 'Atelier Nord',
  renterName: 'Marie Ngo',
  excluded,
  note: excluded ? (boot === 'fr' ? 'Dommage pendant le transport' : 'Damage in transit') : '',
  businessDeclines: excluded ? 4 : 5,
  renterDeclines: 6,
};

function CaptureApp() {
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ background: '#FAF9F7', minHeight: '100vh', padding: 24, maxWidth: 720 }}>
          <DeclineExclusionPanel rows={[row]} onChange={() => undefined} />
        </div>
      </ThemeProvider>
    </I18nextProvider>
  );
}

createRoot(document.getElementById('root')!).render(<CaptureApp />);
