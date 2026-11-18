import './mobile-i18n';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../../apps/mobile/src/contexts/ThemeContext';
import BusinessRentalItemEditScreen from '../../apps/mobile/src/screens/business/BusinessRentalItemEditScreen';
import BusinessInspectionScreen from '../../apps/mobile/src/screens/business/BusinessInspectionScreen';
import ClientInspectionScreen from '../../apps/mobile/src/screens/client/ClientInspectionScreen';
import { sceneName } from './fixtures';

const ITEM = new Set(['edit', 'explainer', 'explainer-momo', 'baseline']);

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

function CaptureRoot() {
  const { paperTheme } = useTheme();
  const scene = sceneName();
  return (
    <PaperProvider theme={paperTheme}>
      <div style={{ minHeight: '100vh', background: '#FAF9F7' }}>
        <Boundary>
          {ITEM.has(scene) ? <BusinessRentalItemEditScreen /> : null}
          {scene === 'pickup' || scene === 'damage' ? <BusinessInspectionScreen /> : null}
          {scene === 'review' ? <ClientInspectionScreen /> : null}
        </Boundary>
      </div>
    </PaperProvider>
  );
}

function App() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
      <ThemeProvider>
        <CaptureRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
