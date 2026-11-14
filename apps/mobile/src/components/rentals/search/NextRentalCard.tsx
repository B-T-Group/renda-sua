import { Image, Pressable, StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { StatusPill } from '../../common/StatusPill';
import { useTheme } from '../../../contexts/ThemeContext';

export function NextRentalCard({
  name,
  period,
  statusLabel,
  imageUrl,
  onOpen,
  onDismiss,
}: {
  name: string;
  period: string;
  statusLabel: string;
  imageUrl?: string | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      testID="rental-next-card"
      accessibilityRole="button"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.divider,
          borderRadius: borderRadius.card,
        },
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.primaryTint }]}>
          <MaterialCommunityIcons name="office-building" size={22} color={colors.secondary.main} />
        </View>
      )}
      <View style={styles.meta}>
        <Text style={[styles.kicker, { color: colors.primary.main }]}>
          {t('rentals.searchFirst.nextRental', 'Next rental')}
        </Text>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text.primary }]}>
          {name}
        </Text>
        <View style={styles.when}>
          <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.text.secondary} />
          <Text numberOfLines={1} style={{ color: colors.text.primary, fontSize: 12, fontWeight: '600' }}>
            {period}
          </Text>
        </View>
      </View>
      <View style={styles.side}>
        <StatusPill compact label={statusLabel} backgroundColor={colors.cta.soft} textColor={colors.success.main} />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('rentals.searchFirst.dismissNext', 'Dismiss')}
          testID="rental-next-card-dismiss"
          hitSlop={8}
          style={styles.dismiss}
        >
          <MaterialCommunityIcons name="close" size={18} color={colors.text.secondary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  name: { fontSize: 13, fontWeight: '800' },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  side: { alignItems: 'flex-end', gap: 4 },
  dismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
