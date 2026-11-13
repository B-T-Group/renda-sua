import CreditCardIcon from '@mui/icons-material/CreditCard';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CheckIcon from '@mui/icons-material/Check';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import HexagonOutlinedIcon from '@mui/icons-material/HexagonOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChargeAtPickupNotice,
  ChargeAtPickupPayLine,
  type ChargeNoticeModel,
} from '../../apps/frontend/src/components/rentals/charge-at-pickup/ChargeAtPickupNotice';

const theme = createTheme({
  palette: { primary: { main: '#0A4FB5' }, text: { primary: '#0F172A' } },
  typography: {
    fontFamily: 'Inter, Roboto, sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
  },
});

const BLUE = '#0A4FB5';
const RENT = '45\u202f000 FCFA';
const DEPOSIT = '45\u202f000 FCFA';

function base(lang: 'en' | 'fr'): Omit<ChargeNoticeModel, 'kind'> {
  const fr = lang === 'fr';
  return {
    itemName: fr ? 'Marteau de charpente' : 'Framing hammer',
    place: "Stripe Rail — L'Assomption",
    bookingNumber: 'RB-204917',
    rent: RENT,
    deposit: DEPOSIT,
    when: fr ? '17 nov. · 08:00' : '17 Nov · 08:00',
    period: fr ? '17 nov. · 08:00 → 25 nov. · 20:00' : '17 Nov · 08:00 → 25 Nov · 20:00',
    heldUntil: fr ? '17 nov. · 09:00' : '17 Nov · 09:00',
    overtime: fr ? '20\u202f000 FCFA' : '20\u202f000 FCFA',
    damage: '25\u202f000 FCFA',
    remainder: '15\u202f000 FCFA',
    cardLabel: '•••• •••• •••• 4242',
  };
}

export function Gallery({ screen, lang }: { screen: string; lang: 'en' | 'fr' }) {
  const model = base(lang);
  const wide = screen.startsWith('08');
  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#FAF9F7' }}>
        {wide ? <WebBooking model={model} lang={lang} /> : <Phone screen={screen} model={model} lang={lang} />}
      </Box>
    </ThemeProvider>
  );
}

function Phone({
  screen,
  model,
  lang,
}: {
  screen: string;
  model: Omit<ChargeNoticeModel, 'kind'>;
  lang: 'en' | 'fr';
}) {
  const title = titleFor(screen, lang);
  const persona = screen.startsWith('07') ? (lang === 'fr' ? 'Entreprise' : 'Business') : lang === 'fr' ? 'Vous' : 'You';
  const biz = screen.startsWith('07');
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FAF9F7', display: 'flex', flexDirection: 'column' }}>
      <Status time={timeFor(screen)} />
      <Header title={title} persona={persona} biz={biz} />
      <Box sx={{ flex: 1, px: 2, pt: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Body screen={screen} model={model} lang={lang} />
      </Box>
      <Box sx={{ height: 18, bgcolor: '#fff', display: 'flex', justifyContent: 'center', pt: 0.75 }}>
        <Box sx={{ width: 110, height: 4, bgcolor: '#0b1220', borderRadius: 2 }} />
      </Box>
    </Box>
  );
}

function Body({
  screen,
  model,
  lang,
}: {
  screen: string;
  model: Omit<ChargeNoticeModel, 'kind'>;
  lang: 'en' | 'fr';
}) {
  if (screen.startsWith('01')) return <ChargeAtPickupNotice model={{ ...model, kind: 'save_card' }} />;
  if (screen.startsWith('02')) return <Before model={model} />;
  if (screen.startsWith('03') || screen.startsWith('04')) return <Accept model={model} decline={screen.startsWith('04')} lang={lang} />;
  if (screen.startsWith('05')) return <Renewal model={model} lang={lang} />;
  if (screen.startsWith('06')) return <Invoice model={model} lang={lang} />;
  return <Business model={model} lang={lang} />;
}

function Before({ model }: { model: Omit<ChargeNoticeModel, 'kind'> }) {
  const { t } = useTranslation();
  return (
    <>
      <Hero />
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography fontWeight={800} fontSize={18}>{model.itemName}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">{model.bookingNumber}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{model.place}</Typography>
        </Box>
        <Pill>{t('rentalInspection.cardSaved', 'Card saved')}</Pill>
      </Stack>
      <ChargeAtPickupNotice model={{ ...model, kind: 'before_pickup', cardLabel: undefined }} />
      <Panel title={t('rentalInspection.paymentAtPickup', 'Payment at pickup')}>
        <Kv k={t('rentalInspection.chargeLabel', 'Charge')} v={model.rent} />
        <Kv k={t('rentalInspection.depositHold', 'Deposit hold')} v={model.deposit} />
        <Kv k={t('rentalInspection.chargedNow', 'Charged now')} v="0 FCFA" emphasis />
      </Panel>
      <Panel>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CreditCardIcon sx={{ color: BLUE }} />
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={800}>Visa •••• 4242</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {t('rentalInspection.savedForPickup', 'Saved for pickup')}
            </Typography>
          </Box>
          <Typography color={BLUE} fontWeight={800} fontSize={13}>{t('rentalInspection.changeCard', 'Change card')}</Typography>
        </Stack>
      </Panel>
      <Panel>
        <Kv k={t('rentals.bookingDetail.period', 'Period')} v={model.period ?? model.when} />
      </Panel>
      <Box sx={{ flex: 1 }} />
      <Button variant="outlined" color="error" sx={{ minHeight: 48, borderRadius: 2, fontWeight: 700 }}>
        {t('rentals.cancelBooking', 'Cancel reservation')}
      </Button>
    </>
  );
}

function Accept({
  model,
  decline,
  lang,
}: {
  model: Omit<ChargeNoticeModel, 'kind'>;
  decline: boolean;
  lang: 'en' | 'fr';
}) {
  const { t } = useTranslation();
  const unit = lang === 'fr' ? 'Unité 1' : 'Unit 1';
  return (
    <>
      {decline ? (
        <ChargeAtPickupNotice model={{ ...model, kind: 'decline', hideActions: true }} />
      ) : (
        <Banner>
          {t('rentalInspection.mustReviewAll', 'Review every unit before accepting. This locks the pickup baseline.')}
        </Banner>
      )}
      <Box sx={{ border: '1.5px solid #0A4FB5', bgcolor: '#D6E4F7', borderRadius: 2, py: 1.25, textAlign: 'center', fontWeight: 800, color: '#0B2E6F' }}>
        {unit} ✓
      </Box>
      <Panel>
        <Typography fontWeight={800}>{model.itemName} · {unit}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {model.place} · {lang === 'fr' ? "aujourd'hui" : 'today'} 08:02
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Photo label={lang === 'fr' ? "Vue d'ensemble" : 'Overview'} icon={<PhotoCameraOutlinedIcon sx={{ color: '#fff' }} />} />
          <Photo label={lang === 'fr' ? 'Autre côté' : 'Other side'} icon={<PhotoCameraOutlinedIcon sx={{ color: '#fff' }} />} />
          <Photo label={lang === 'fr' ? 'Accessoires' : 'Accessories'} icon={<HexagonOutlinedIcon sx={{ color: '#fff' }} />} />
        </Stack>
        <Check text={lang === 'fr' ? 'Bon état général' : 'Overall good'} />
        <Check text={lang === 'fr' ? 'Manche + étui · 2' : 'Handle + sleeve · 2'} />
        <Check text={lang === 'fr' ? 'Aucune usure existante' : 'No existing wear'} />
      </Panel>
      <Typography textAlign="center" variant="caption" color="text.secondary" fontWeight={700}>
        {lang === 'fr' ? '1 sur 1 vérifiée' : '1 of 1 reviewed'}
      </Typography>
      <Box sx={{ flex: 1 }} />
      {decline ? null : <ChargeAtPickupPayLine rent={model.rent} deposit={model.deposit} />}
      {decline ? (
        <>
          <Button variant="contained" startIcon={<CreditCardIcon />} sx={{ bgcolor: BLUE, minHeight: 48, borderRadius: 2 }}>
            {t('rentalInspection.updateCard', 'Update card')}
          </Button>
          <Button variant="outlined" sx={{ minHeight: 48, borderRadius: 2, borderColor: BLUE, color: BLUE }}>
            {t('rentalInspection.retryCharge', 'Try again')}
          </Button>
        </>
      ) : (
        <>
          <Button variant="contained" startIcon={<CheckIcon />} sx={{ bgcolor: BLUE, minHeight: 48, borderRadius: 2 }}>
            {t('rentalInspection.acceptAndStart', 'Accept condition & start rental')}
          </Button>
          <Button variant="outlined" color="error" startIcon={<FlagOutlinedIcon />} sx={{ minHeight: 48, borderRadius: 2 }}>
            {t('rentalInspection.reportProblem', 'Report a problem')}
          </Button>
        </>
      )}
    </>
  );
}

function Renewal({ model, lang }: { model: Omit<ChargeNoticeModel, 'kind'>; lang: 'en' | 'fr' }) {
  const { t } = useTranslation();
  const steps = lang === 'fr'
    ? ['Offre prête', 'Prêt au retrait', 'En cours', 'Retour dû']
    : ['Offer ready', 'Ready for pickup', 'In progress', 'Return due'];
  return (
    <>
      <Hero />
      <Stack direction="row" justifyContent="space-between">
        <Box>
          <Typography fontWeight={800} fontSize={18}>{model.itemName}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">{model.bookingNumber}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{model.place}</Typography>
        </Box>
        <Pill ok>{lang === 'fr' ? 'En cours' : 'In progress'}</Pill>
      </Stack>
      <ChargeAtPickupNotice model={{ ...model, kind: 'renewal_failed' }} />
      <Panel title={lang === 'fr' ? 'Statut' : 'Status'}>
        {steps.map((label, index) => (
          <Stack key={label} direction="row" spacing={1} alignItems="center" sx={{ py: 0.4 }}>
            <Box sx={{
              width: 20, height: 20, borderRadius: '50%',
              bgcolor: index < 3 ? (index === 2 ? BLUE : '#0F766E') : '#fff',
              border: index < 3 ? 0 : '2px solid #D0C9BE',
              display: 'grid', placeItems: 'center',
            }}>
              {index < 3 ? <CheckIcon sx={{ color: '#fff', fontSize: 12 }} /> : null}
            </Box>
            <Typography fontWeight={index === 2 ? 800 : 600} color={index === 3 ? 'text.disabled' : 'text.primary'}>{label}</Typography>
          </Stack>
        ))}
      </Panel>
      <Panel>
        <Kv k={t('rentals.bookingDetail.period', 'Period')} v={model.period ?? ''} />
        <Kv k={lang === 'fr' ? 'Débit' : 'Charged'} v={model.rent} />
        <Kv k={t('rentalInspection.depositHold', 'Deposit hold')} v={model.deposit} />
        <Kv k={lang === 'fr' ? 'Dépôt expire le' : 'Hold expires'} v={lang === 'fr' ? '15 nov. · 20:00' : '15 Nov · 20:00'} />
      </Panel>
    </>
  );
}

function Invoice({ model, lang }: { model: Omit<ChargeNoticeModel, 'kind'>; lang: 'en' | 'fr' }) {
  const { t } = useTranslation();
  return (
    <>
      <Hero />
      <Stack direction="row" justifyContent="space-between">
        <Box>
          <Typography fontWeight={800} fontSize={18}>{model.itemName}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">{model.bookingNumber}</Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>{model.place}</Typography>
        </Box>
        <Pill warn>{lang === 'fr' ? 'Reliquat dû' : 'Remainder due'}</Pill>
      </Stack>
      <ChargeAtPickupNotice model={{ ...model, kind: 'remainder', hideActions: true }} />
      <Panel>
        <Kv k={lang === 'fr' ? 'Heures supplémentaires' : 'Overtime'} v="20\u202f000 FCFA" />
        <Kv k={lang === 'fr' ? 'Dommages' : 'Damage'} v="40\u202f000 FCFA" />
        <Kv k={lang === 'fr' ? 'Caution utilisée' : 'Deposit applied'} v={model.deposit} />
        <Kv k={lang === 'fr' ? 'Reste à payer' : 'Remainder'} v={model.remainder ?? ''} emphasis />
      </Panel>
      <Box sx={{ flex: 1 }} />
      <Button variant="contained" sx={{ bgcolor: BLUE, minHeight: 48, borderRadius: 2 }}>
        {t('rentalInspection.payRemainder', 'Pay {{amount}}', { amount: model.remainder ?? '' })}
      </Button>
    </>
  );
}

function Business({ model, lang }: { model: Omit<ChargeNoticeModel, 'kind'>; lang: 'en' | 'fr' }) {
  return (
    <Stack spacing={2} sx={{ flex: 1, justifyContent: 'center', pb: 8 }}>
      <Box sx={{ width: 72, height: 72, borderRadius: 3, bgcolor: '#DCF5E5', display: 'grid', placeItems: 'center', mx: 'auto' }}>
        <CheckIcon sx={{ color: '#0F766E', fontSize: 36 }} />
      </Box>
      <ChargeAtPickupNotice model={{ ...model, kind: 'business_started' }} />
      <Panel>
        <Typography fontWeight={800}>{model.itemName}</Typography>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {model.bookingNumber} · Amina
        </Typography>
        <Kv k={lang === 'fr' ? 'Débité' : 'Charged'} v={model.rent} />
        <Kv k={lang === 'fr' ? 'Caution bloquée' : 'Deposit held'} v={model.deposit} />
        <Kv k={lang === 'fr' ? 'Retour dû' : 'Return due'} v={lang === 'fr' ? '25 nov. · 20:00' : '25 Nov · 20:00'} />
      </Panel>
    </Stack>
  );
}

function WebBooking({ model, lang }: { model: Omit<ChargeNoticeModel, 'kind'>; lang: 'en' | 'fr' }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F4F2EE', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" sx={{ height: 42, bgcolor: '#1e293b', px: 1.5, gap: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f87171' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#fbbf24' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#34d399' }} />
        <Box sx={{ flex: 1, bgcolor: '#0f172a', color: '#94a3b8', borderRadius: 1, px: 1.5, py: 0.5, ml: 1, fontSize: 12 }}>
          rendasua.com/rentals/bookings/RB-204917
        </Box>
      </Stack>
      <Box sx={{ p: 3, display: 'grid', gridTemplateColumns: '360px 1fr', gap: 3 }}>
        <Box>
          <Hero tall />
          <Typography fontWeight={800} fontSize={26} sx={{ mt: 1.5 }}>{model.itemName}</Typography>
          <Typography color="text.secondary" fontWeight={700}>{model.bookingNumber}</Typography>
          <Typography color="text.secondary" fontWeight={700}>{model.place}</Typography>
        </Box>
        <Stack spacing={1.5}>
          <ChargeAtPickupNotice model={{ ...model, kind: 'before_pickup', cardLabel: 'Visa •••• 4242' }} />
          <Panel title={t('rentalInspection.paymentAtPickup', 'Payment at pickup')}>
            <Kv k={t('rentalInspection.chargeLabel', 'Charge')} v={model.rent} />
            <Kv k={t('rentalInspection.depositHold', 'Deposit hold')} v={model.deposit} />
            <Kv k={t('rentalInspection.chargedNow', 'Charged now')} v="0 FCFA" emphasis />
          </Panel>
          <Typography color="text.secondary">
            {lang === 'fr' ? 'Annulation gratuite avant le retrait.' : 'Free cancellation before pickup.'}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function Status({ time }: { time: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pt: 0.75, fontSize: 12, fontWeight: 800 }}>
      <span>{time}</span>
      <span>▮▮</span>
    </Stack>
  );
}

function Header({ title, persona, biz }: { title: string; persona: string; biz: boolean }) {
  return (
    <Stack direction="row" alignItems="center" sx={{ minHeight: 52, bgcolor: '#fff', borderBottom: '1px solid #E6E1D8', px: 0.5 }}>
      <ArrowBackIcon sx={{ color: biz ? '#085C2C' : BLUE, mx: 1 }} />
      <Typography fontWeight={800} sx={{ flex: 1, textAlign: 'center' }}>{title}</Typography>
      <Box sx={{
        fontSize: 9, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
        px: 0.75, py: 0.4, borderRadius: 0.75, mr: 1,
        bgcolor: biz ? '#DCF5E5' : '#D6E4F7', color: biz ? '#085C2C' : BLUE,
      }}>{persona}</Box>
    </Stack>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1} sx={{ bgcolor: '#E8EEF6', borderRadius: 2, p: 1.25 }}>
      <InfoOutlinedIcon sx={{ color: BLUE }} />
      <Typography color={BLUE} fontWeight={700} fontSize={13}>{children}</Typography>
    </Stack>
  );
}

function Hero({ tall }: { tall?: boolean }) {
  return (
    <Box sx={{
      height: tall ? 180 : 120, borderRadius: 2,
      background: 'linear-gradient(160deg,#2F6FD6,#0A4FB5)',
      display: 'grid', placeItems: 'center', color: '#fff',
    }}>
      <LockOutlinedIcon sx={{ fontSize: tall ? 48 : 40 }} />
    </Box>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #E6E1D8', borderRadius: 2, p: 1.5 }}>
      {title ? <Typography fontWeight={800} sx={{ mb: 0.5 }}>{title}</Typography> : null}
      {children}
    </Box>
  );
}

function Kv({ k, v, emphasis }: { k: string; v: string; emphasis?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: '1px solid #E6E1D8', '&:last-child': { borderBottom: 0 } }}>
      <Typography color="text.secondary" fontWeight={600} fontSize={13}>{k}</Typography>
      <Typography fontWeight={800} fontSize={emphasis ? 16 : 13} color={emphasis ? BLUE : 'text.primary'}>{v}</Typography>
    </Stack>
  );
}

function Pill({ children, ok, warn }: { children: ReactNode; ok?: boolean; warn?: boolean }) {
  const bg = warn ? '#FEF3C7' : ok ? '#DCF5E5' : '#D6E4F7';
  const color = warn ? '#B45309' : ok ? '#0F766E' : BLUE;
  return <Box sx={{ fontSize: 11, fontWeight: 700, px: 1, py: 0.5, borderRadius: 999, bgcolor: bg, color, whiteSpace: 'nowrap' }}>{children}</Box>;
}

function Photo({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <Box sx={{
      flex: 1, aspectRatio: '1', borderRadius: 1.5,
      background: 'linear-gradient(160deg,#9aa8bd,#64748b)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', pb: 0.75,
    }}>
      <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>{icon}</Box>
      <Typography fontSize={10} fontWeight={700} color="#fff">{label}</Typography>
    </Box>
  );
}

function Check({ text }: { text: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 0.75, borderBottom: '1px solid #E6E1D8' }}>
      <Box sx={{ width: 22, height: 22, borderRadius: 0.75, bgcolor: '#0F766E', display: 'grid', placeItems: 'center' }}>
        <CheckIcon sx={{ color: '#fff', fontSize: 14 }} />
      </Box>
      <Typography fontWeight={700} fontSize={13}>{text}</Typography>
    </Stack>
  );
}

function titleFor(screen: string, lang: 'en' | 'fr'): string {
  const fr = lang === 'fr';
  if (screen.startsWith('01')) return fr ? 'Confirmer la réservation' : 'Confirm reservation';
  if (screen.startsWith('03') || screen.startsWith('04')) return fr ? "Vérifiez l'état de l'article" : 'Review item condition';
  return fr ? 'Réservation' : 'Booking';
}

function timeFor(screen: string): string {
  if (screen.startsWith('01')) return '08:12';
  if (screen.startsWith('03') || screen.startsWith('04')) return '08:06';
  if (screen.startsWith('05')) return '11:20';
  if (screen.startsWith('06')) return '18:40';
  if (screen.startsWith('07')) return '08:07';
  return '10:04';
}
