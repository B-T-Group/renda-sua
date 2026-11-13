import { createRoot } from 'react-dom/client';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CardWindowDateSheet } from '../../apps/mobile/src/components/rentals/request/CardWindowDateSheet';
import { CardWindowNotice } from '../../apps/mobile/src/components/rentals/request/CardWindowNotice';
import { cardWindowNote, cardWindowWarning } from '../../apps/mobile/src/utils/rentals/cardWindow';

const NOW = new Date('2026-11-12T19:00:00.000Z');
const LATEST = '2026-11-15T19:00:00.000Z';
const params = new URLSearchParams(location.search);
const scene = params.get('scene') || '01';
const french = params.get('lang') === 'fr';
const locale = french ? 'fr' : 'en';
const cutoff = french ? '15 nov. · 20:00' : '15 Nov · 20:00';

function App() {
  if (scene === '01' || scene === '02') {
    return (
      <CardWindowDateSheet
        visible
        locale={locale}
        timeZone="Africa/Douala"
        latestIso={LATEST}
        momoAvailable={scene === '02'}
        payingByCard
        now={NOW}
        pickup="2026-11-13"
        onClose={() => undefined}
        onApply={() => undefined}
        onPayWithMomo={() => undefined}
      />
    );
  }
  if (scene === '08') return <Assistant french={french} cutoff={cutoff} />;
  return <Summary french={french} cutoff={cutoff} fallback={scene === '04'} />;
}

function Summary({ french, cutoff, fallback }: { french: boolean; cutoff: string; fallback: boolean }) {
  return (
    <View style={styles.page}>
      <Text style={styles.clock}>20:00</Text>
      <Text style={styles.heading}>{french ? 'Demander cette location' : 'Request this rental'}</Text>
      <Text style={styles.sub}>Framing hammer</Text>
      <View style={styles.card}>
        <Text style={styles.item}>Framing hammer</Text>
        <Text style={styles.meta}>Stripe Rail — L'Assomption</Text>
        <Text style={styles.dates}>{french ? '17–18 nov. · 1 jour' : '17–18 Nov · 1 day'}</Text>
        <Text style={styles.when}>{french ? 'mar. 17 nov. · Journée' : 'Tue 17 Nov · All day'}</Text>
      </View>
      <CardWindowNotice
        tone={fallback ? 'error' : 'warn'}
        title={
          fallback
            ? french
              ? 'Impossible de continuer'
              : 'Can’t continue with these dates'
            : undefined
        }
        body={
          fallback
            ? cardWindowNote(cutoff, french ? 'fr' : 'en')
            : cardWindowWarning(cutoff, french ? 'fr' : 'en')
        }
        action={french ? 'Modifier les dates' : 'Change dates'}
        onAction={() => undefined}
      />
      <View style={styles.card}>
        <Text style={styles.kicker}>{french ? 'QUANTITÉ' : 'QUANTITY'}</Text>
        <Text style={styles.qty}>1</Text>
        <Text style={styles.meta}>{french ? '1 sur 1 disponible pour vos dates' : '1 of 1 available for your dates'}</Text>
      </View>
      <Text style={styles.line}>{french ? '1 jour × 45 000 FCFA / jour' : '1 day × 45 000 FCFA / day'}</Text>
      <Text style={styles.total}>45 000 FCFA</Text>
      <Text style={styles.reason}>{cardWindowNote(cutoff, french ? 'fr' : 'en')}</Text>
      <Pressable disabled style={styles.send}>
        <Text style={styles.sendText}>{french ? 'Envoyer la demande' : 'Send request'}</Text>
      </Pressable>
    </View>
  );
}

function Assistant({ french, cutoff }: { french: boolean; cutoff: string }) {
  const ask = french
    ? 'Je veux louer un marteau du 17 au 18 novembre'
    : 'I want to rent a hammer from 17th – 18th of November';
  const reply = french
    ? `Ces dates dépassent la limite d’une location payée par carte. Avec une carte, cette location doit se terminer le ${cutoff}. Voici des dates plus tôt :`
    : `Those dates are past the card limit for an inspected rental. With a card, this rental must end by ${cutoff}. Here are earlier dates you can try:`;
  return (
    <View style={styles.page}>
      <Text style={styles.clock}>20:00</Text>
      <Text style={styles.heading}>Rendasua</Text>
      <View style={styles.user}><Text style={styles.userText}>{ask}</Text></View>
      <View style={styles.bot}><Text style={styles.botText}>{reply}</Text></View>
      <View style={styles.chip}><Text style={styles.chipText}>{french ? '13 nov. → 15 nov. · 3 jours' : '13 Nov → 15 Nov · 3 days'}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAF9F7', padding: 16, gap: 10 },
  clock: { fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '800', color: '#0F2744' },
  sub: { color: '#64748B', marginTop: -8 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E7E5E4' },
  item: { fontWeight: '800', fontSize: 16, color: '#0F2744' },
  meta: { color: '#64748B', marginTop: 2 },
  dates: { marginTop: 8, fontWeight: '800', color: '#0F2744' },
  when: { color: '#64748B', marginTop: 4 },
  kicker: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  qty: { fontSize: 18, fontWeight: '800', marginVertical: 6 },
  line: { color: '#0F2744' },
  total: { fontSize: 22, fontWeight: '800', color: '#0A4FB5' },
  reason: { color: '#B45309', fontWeight: '600' },
  send: { height: 48, borderRadius: 12, backgroundColor: '#E7E5E4', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#A8A29E', fontWeight: '800' },
  user: { alignSelf: 'flex-end', backgroundColor: '#0A4FB5', borderRadius: 16, padding: 12, maxWidth: '85%' },
  userText: { color: '#fff' },
  bot: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E7E5E4' },
  botText: { color: '#0F2744', lineHeight: 20 },
  chip: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#0A4FB5', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: '#0A4FB5', fontWeight: '800' },
});

createRoot(document.getElementById('root')!).render(<App />);
