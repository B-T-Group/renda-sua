import { createRoot } from 'react-dom/client';
import { Box, Button, Typography } from '@mui/material';
import { CardWindowBanner, CardWindowCalendar } from '../../apps/frontend/src/components/rentals/CardWindowCalendar';
import { cardWindowSendReason, cardWindowWarning } from '../../apps/frontend/src/utils/rentals/cardWindow';
import { formatCardCutoff } from '../../apps/backend/src/rentals/inspection/card-window.copy';

const NOW = new Date('2026-11-12T19:00:00.000Z');
const params = new URLSearchParams(location.search);
const scene = params.get('scene') || '05';
const french = params.get('lang') === 'fr';
const locale = french ? 'fr' : 'en';
const cutoff = formatCardCutoff('2026-11-15T19:00:00.000Z', 'Africa/Douala', locale);
const momo = scene === '06';
const fields = {
  mode: 'authorize_upfront' as const,
  payment_rail: momo ? ('mobile_money' as const) : ('stripe' as const),
  momo_available: momo,
  inspection_enabled: true,
  latest_card_end_at: '2026-11-15T19:00:00.000Z',
  card_auth_window_days: 6,
  stripe_review_hours: 72,
  timezone: 'Africa/Douala',
};

function App() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0F2744', fontFamily: 'Inter, sans-serif' }}>
      <Box sx={{ height: 28, px: 2, display: 'flex', alignItems: 'center', color: '#fff', fontSize: 12 }}>
        dev.rendasua.com/rentals/hammer
      </Box>
      <Box sx={{ bgcolor: '#FAF9F7', minHeight: 'calc(100vh - 28px)', p: 3, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 3 }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#0A4FB5' }}>{french ? '← Retour à l’annonce' : '← Back to listing'}</Typography>
          <Box sx={{ mt: 1, height: 160, borderRadius: 2, bgcolor: '#0A4FB5' }} />
          <Typography variant="h5" sx={{ mt: 2, fontWeight: 800 }}>Framing hammer</Typography>
          <Typography variant="body2" color="text.secondary">Stripe Rail — L'Assomption · 45 000 FCFA / day</Typography>
        </Box>
        <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 3, border: '1px solid #E7E5E4' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>{french ? 'Demander cette location' : 'Request this rental'}</Typography>
          {scene === '07' ? <WebSummary french={french} cutoff={cutoff} /> : (
            <CardWindowCalendar fields={fields} payingByCard locale={locale} now={NOW} pickup="2026-11-13" onPayWithMomo={() => undefined} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

function WebSummary({ french, cutoff }: { french: boolean; cutoff: string }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 800 }}>{french ? '17–18 nov. · 1 jour' : '17–18 Nov · 1 day'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>{french ? 'mar. 17 nov. · Journée' : 'Tue 17 Nov · All day'}</Typography>
      <CardWindowBanner
        tone="warn"
        body={cardWindowWarning(cutoff, french ? 'fr' : 'en')}
        action={french ? 'Modifier les dates' : 'Change dates'}
        onAction={() => undefined}
      />
      <Typography sx={{ mt: 2 }}>{french ? '1 jour × 45 000 FCFA / jour' : '1 day × 45 000 FCFA / day'}</Typography>
      <Typography sx={{ fontWeight: 800, color: '#0A4FB5', fontSize: 22 }}>45 000 FCFA</Typography>
      <Typography sx={{ color: '#B45309', fontWeight: 600, mb: 1 }}>{cardWindowSendReason(locale)}</Typography>
      <Button disabled fullWidth sx={{ bgcolor: '#E7E5E4', color: '#A8A29E' }}>{french ? 'Envoyer la demande' : 'Send request'}</Button>
    </Box>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
