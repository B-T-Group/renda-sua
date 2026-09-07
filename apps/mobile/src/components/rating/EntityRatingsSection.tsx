import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, Divider, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useEntityRatings } from '../../hooks/useEntityRatings';
import { StarRatingDisplay } from './StarRatingDisplay';

export interface EntityRatingsSectionProps {
  entityType: string;
  entityId: string;
  title?: string;
  /** Copy shown when the entity has no ratings yet; section hides entirely when omitted. */
  emptyText?: string;
  style?: object;
}

/**
 * Self-contained rating summary + public reviews list for an entity
 * (item detail, agent/client profile). Hides itself when there are no
 * ratings and no emptyText was provided.
 */
export function EntityRatingsSection({
  entityType,
  entityId,
  title,
  emptyText,
  style,
}: EntityRatingsSectionProps) {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const locale = i18n.language.startsWith('fr') ? 'fr-FR' : 'en-US';
  const { aggregate, ratings, loading, hasMore, loadMore } = useEntityRatings(
    entityType,
    entityId
  );

  const total = aggregate?.total_ratings ?? 0;
  if (total === 0 && !emptyText) return null;

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
        style,
      ]}
    >
      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
        {title ?? t('rating.reviewsTitle', 'Ratings & reviews')}
      </Text>

      {total > 0 ? (
        <View style={[styles.summaryRow, { marginTop: spacing.xs }]}>
          <Text style={[typography.h4, { color: colors.text.primary, fontWeight: '700' }]}>
            {Number(aggregate!.average_rating).toFixed(1)}
          </Text>
          <View style={{ gap: 2 }}>
            <StarRatingDisplay average={Number(aggregate!.average_rating)} size={16} />
            <Text style={[typography.caption, { color: colors.text.secondary }]}>
              {t('rating.ratingCount', '{{count}} rating(s)', { count: total })}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.xs }]}>
          {emptyText}
        </Text>
      )}

      {ratings.map((rating, idx) => (
        <View key={rating.id}>
          {idx > 0 ? <Divider style={{ marginVertical: spacing.xs }} /> : null}
          <View style={{ marginTop: idx === 0 ? spacing.sm : 0 }}>
            <View style={styles.reviewHeader}>
              <StarRatingDisplay average={rating.rating} size={13} />
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {new Date(rating.created_at).toLocaleDateString(locale)}
              </Text>
            </View>
            {rating.comment?.trim() ? (
              <Text style={[typography.body2, { color: colors.text.primary, marginTop: 4 }]}>
                {rating.comment.trim()}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      {loading ? (
        <ActivityIndicator size="small" style={{ marginTop: spacing.sm }} />
      ) : hasMore ? (
        <Button mode="text" compact onPress={() => void loadMore()} style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
          {t('rating.loadMoreReviews', 'Load more reviews')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
