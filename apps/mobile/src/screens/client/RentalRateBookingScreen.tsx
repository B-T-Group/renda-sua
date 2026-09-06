import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Snackbar, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useRentalBookingDetail } from '../../hooks/useRentalBookingDetail';
import { agentApi } from '../../services/agentApi';

type Params = { RentalRateBooking: { bookingId: string } };

function StarRow({
  value,
  onChange,
  colors,
}: {
  value: number;
  onChange: (n: number) => void;
  colors: { primary: { main: string }; text: { disabled: string } };
}) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${n} stars`}
        >
          <MaterialCommunityIcons
            name={value >= n ? 'star' : 'star-outline'}
            size={40}
            color={value >= n ? colors.primary.main : colors.text.disabled}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function RentalRateBookingScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<Params, 'RentalRateBooking'>>();
  const bookingId = route.params?.bookingId;
  const { booking, loading } = useRentalBookingDetail(bookingId, {
    pollPaymentWhenProposed: false,
  });

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const businessId = booking?.business_id;
  const itemName =
    booking?.rental_location_listing?.rental_item?.name ??
    t('rentals.clientRequests.unknownItem', 'Rental');

  const submit = useCallback(async () => {
    if (!bookingId || stars < 1) return;
    if (!businessId) {
      setSnack(t('rentals.requestFailed', 'Request failed'));
      return;
    }
    setSubmitting(true);
    try {
      const businessRes = await agentApi.ratings.create({
        rentalBookingId: bookingId,
        ratingType: 'client_to_rental_business',
        ratedEntityType: 'business',
        ratedEntityId: businessId,
        rating: stars,
        comment: comment.trim() || undefined,
        isPublic: true,
      });
      if (!businessRes.success) {
        throw new Error(businessRes.message || 'Failed to submit rating');
      }
      setSnack(t('rentals.rateSuccess', 'Thanks for your rating'));
      setTimeout(() => navigation.goBack(), 800);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('rentals.requestFailed', 'Request failed'));
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, businessId, comment, navigation, stars, t]);

  return (
    <View
      style={[
        styles.safe,
        {
          backgroundColor: colors.pageBackground,
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={[typography.h6, { color: colors.text.primary }]}>
          {t('client.rentals.rateRental', 'Rate this rental')}
        </Text>
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: 4 }]}>
          {loading ? t('common.loading', 'Loading…') : itemName}
        </Text>
        <StarRow value={stars} onChange={setStars} colors={colors} />
        <TextInput
          mode="outlined"
          multiline
          numberOfLines={4}
          value={comment}
          onChangeText={setComment}
          label={t('rentals.rateComment', 'Comment (optional)')}
          style={{ marginTop: spacing.md }}
        />
        <Button
          mode="contained"
          style={{ marginTop: spacing.md }}
          disabled={stars < 1 || submitting || !booking}
          loading={submitting}
          onPress={() => void submit()}
        >
          {t('common.submit', 'Submit')}
        </Button>
      </View>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={3000}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { borderWidth: 1 },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
});
