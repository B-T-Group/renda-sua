/** Renders the real web request components. Not imported by the web app entry. */
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import './web-i18n';
import { BusinessDashboardRentalRequests } from '../../apps/frontend/src/components/business/BusinessDashboardRentalRequests';
import BusinessRentalsRequestsPage from '../../apps/frontend/src/components/pages/BusinessRentalsRequestsPage';
import { ClientRentalRequestRowCard } from '../../apps/frontend/src/components/rentals/ClientRentalRequestRowCard';
import { sceneName, renterRequest } from './fixtures';

const theme = createTheme({ palette: { mode: 'light', background: { default: '#FAF9F7' } } });

function Capture() {
  const scene = sceneName();
  useEffect(() => {
    const id = window.setTimeout(() => {
      document.body.dataset.ready = '1';
    }, 500);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <SnackbarProvider>
        <MemoryRouter initialEntries={['/business/rentals/requests']}>
          <div style={{ background: '#FAF9F7', minHeight: 120, padding: 16 }}>
            {scene === 'list' ? <BusinessRentalsRequestsPage /> : null}
            {scene === 'renter' ? (
              <ClientRentalRequestRowCard
                row={renterRequest() as never}
                bookingLoading={false}
                onBookRequest={() => undefined}
                onCancel={() => undefined}
                onViewListing={() => undefined}
                onViewBooking={() => undefined}
                onBrowseRentals={() => undefined}
              />
            ) : null}
            {scene !== 'list' && scene !== 'renter' ? <BusinessDashboardRentalRequests /> : null}
          </div>
        </MemoryRouter>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Capture />);
