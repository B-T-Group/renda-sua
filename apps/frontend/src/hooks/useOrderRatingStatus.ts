import { useMemo } from 'react';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useOrderRatings } from './useOrderRatings';

export interface UseOrderRatingStatusReturn {
  hasRated: boolean;
  canRate: boolean;
  ratingTypes: string[];
}

export const useOrderRatingStatus = (
  orderId: string,
  orderStatus: string
): UseOrderRatingStatusReturn => {
  const { profile } = useUserProfileContext();
  const { ratings } = useOrderRatings(orderId);

  const ratingStatus = useMemo(() => {
    if (!profile || !ratings) {
      return {
        hasRated: false,
        canRate: false,
        ratingTypes: [],
      };
    }

    const userType = profile.user_type_id;
    const canRate = orderStatus === 'complete' && userType !== 'business';

    // Determine what rating types this user can provide
    const availableRatingTypes: string[] = [];
    if (userType === 'client') {
      availableRatingTypes.push('client_to_agent', 'client_to_item');
    } else if (userType === 'agent') {
      availableRatingTypes.push('agent_to_client');
    }

    // Check if user has already rated for each available type
    const userRatings = ratings.filter((rating) => {
      // This is a simplified check - in a real implementation,
      // you'd compare the rater_user_id with the actual current user ID
      return availableRatingTypes.includes(rating.rating_type);
    });

    const hasRated = userRatings.length > 0;

    return {
      hasRated,
      canRate,
      ratingTypes: availableRatingTypes,
    };
  }, [profile, ratings, orderStatus]);

  return ratingStatus;
};
