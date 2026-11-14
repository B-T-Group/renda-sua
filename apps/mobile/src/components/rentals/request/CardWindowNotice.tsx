import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

export function CardWindowNotice(props: {
  tone: 'warn' | 'error';
  title?: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const warn = props.tone === 'warn';
  return (
    <View style={[styles.banner, warn ? styles.warn : styles.error]}>
      <Text style={{ color: warn ? '#B45309' : '#B91C1C', fontWeight: '800' }}>!</Text>
      <View style={styles.body}>
        {props.title ? <Text style={[styles.title, warn ? styles.warnText : styles.errorText]}>{props.title}</Text> : null}
        <Text style={[styles.copy, warn ? styles.warnText : styles.errorText]}>{props.body}</Text>
        <Pressable accessibilityRole="button" onPress={props.onAction} style={styles.action}>
          <Text style={styles.actionText}>✎</Text>
          <Text style={styles.actionText}>{props.action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 10, borderWidth: 1 },
  warn: { backgroundColor: '#FEF3C7', borderColor: '#F5D38A' },
  error: { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
  body: { flex: 1 },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  copy: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  warnText: { color: '#7C3D0A' },
  errorText: { color: '#7F1D1D' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 6 },
  actionText: { color: '#0A4FB5', fontWeight: '800', fontSize: 13 },
});
