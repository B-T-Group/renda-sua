import { useTranslation } from 'react-i18next';
import { useMyRatingAggregate } from '../../hooks/useMyRatingAggregate';
import { UserMenuRow } from '../common/UserMenuRow';
import { StarRatingDisplay } from './StarRatingDisplay';

export interface MyRatingMenuRowProps {
  persona: 'agent' | 'client';
  onPress: () => void;
}

/** Menu row showing the current persona's received rating (stars + count), linking to profile. */
export function MyRatingMenuRow({ persona, onPress }: MyRatingMenuRowProps) {
  const { t } = useTranslation();
  const { aggregate } = useMyRatingAggregate(persona);
  const total = aggregate?.total_ratings ?? 0;

  return (
    <UserMenuRow
      icon="star-outline"
      label={t('rating.myRatingsTitle', 'My ratings')}
      subtitle={
        total > 0
          ? t('rating.ratingCount', '{{count}} rating(s)', { count: total })
          : t('rating.noRatingsYet', 'No ratings yet.')
      }
      onPress={onPress}
      trailingElement={
        total > 0 ? (
          <StarRatingDisplay
            average={Number(aggregate!.average_rating)}
            size={14}
          />
        ) : undefined
      }
    />
  );
}
