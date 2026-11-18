import '../../apps/mobile/src/i18n';
import i18n from 'i18next';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ThemeProvider, useTheme } from '../../apps/mobile/src/contexts/ThemeContext';
import { RentalSearchFirstScreen } from '../../apps/mobile/src/screens/shared/RentalSearchFirstScreen';

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang') === 'fr' ? 'fr' : 'en';
const scene = params.get('scene') || 'douala';
void i18n.changeLanguage(lang);

class Boundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.stack || error.message };
  }

  render() {
    if (this.state.error) return <pre style={{ whiteSpace: 'pre-wrap', color: '#9b1c1c' }}>{this.state.error}</pre>;
    return this.props.children;
  }
}

function Capture() {
  const { paperTheme } = useTheme();
  const searching = scene === 'search';
  return (
    <PaperProvider
      theme={paperTheme}
      settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
    >
      <div style={{ minHeight: '100vh', background: '#FAF9F7' }}>
        <Boundary>
          <RentalSearchFirstScreen
            withAuth={false}
            applyTopSafeArea
            initialQuery={searching ? (lang === 'fr' ? 'appareil photo' : 'camera') : ''}
            initialDates={searching ? { startDate: '2026-11-22', endDate: '2026-11-24', dayCount: 3 } : null}
          />
        </Boundary>
      </div>
    </PaperProvider>
  );
}

function App() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 12, right: 0, bottom: 16, left: 0 },
        frame: { x: 0, y: 0, width: 390, height: 1600 },
      }}
    >
      <ThemeProvider>
        <NavigationContainer>
          <Capture />
        </NavigationContainer>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
