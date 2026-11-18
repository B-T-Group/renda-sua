/** Renders the real mobile request components. Not imported by App.tsx or index.js. */
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './mobile-i18n';
import { ThemeProvider, useTheme } from '../../apps/mobile/src/contexts/ThemeContext';
import { DashboardRentalRequests } from '../../apps/mobile/src/components/business/DashboardRentalRequests';
import BusinessRentalsStudioScreen from '../../apps/mobile/src/screens/business/BusinessRentalsStudioScreen';
import { ClientRentalRequestRow } from '../../apps/mobile/src/components/rentals/ClientRentalRequestRow';
import { sceneName, renterRequest } from './fixtures';

function Ready() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.body.dataset.ready = '1';
    }, 700);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

function Shell() {
  const { paperTheme } = useTheme();
  const scene = sceneName();
  return (
    <SafeAreaProvider
      initialMetrics={{
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        frame: { x: 0, y: 0, width: 390, height: 844 },
      }}
    >
    <PaperProvider theme={paperTheme}>
      <Ready />
      {scene === 'list' ? <BusinessRentalsStudioScreen /> : null}
      {scene === 'renter' ? (
        <ClientRentalRequestRow
          row={renterRequest() as never}
          onBookRequest={() => undefined}
          onCancel={() => undefined}
          onViewListing={() => undefined}
          onViewBooking={() => undefined}
          onBrowseRentals={() => undefined}
        />
      ) : null}
      {scene !== 'list' && scene !== 'renter' ? <DashboardRentalRequests /> : null}
    </PaperProvider>
    </SafeAreaProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );
}
