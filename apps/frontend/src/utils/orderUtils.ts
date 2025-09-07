import type { OrderData } from '../hooks/useOrderById';

/**
 * Check if an order has been in pending payment status for more than the specified duration
 * @param order - The order to check
 * @param hoursThreshold - Number of hours to wait before allowing cancellation (default: 1)
 * @returns boolean indicating if the order can be cancelled due to long pending payment
 */
export const canCancelDueToPendingPayment = (
  order: OrderData,
  hoursThreshold = 1
): boolean => {
  // Only check orders that are currently in pending payment status
  if (order.payment_status !== 'pending') {
    return false;
  }

  // Don't allow cancellation if order is already cancelled or refunded
  if (['cancelled', 'refunded'].includes(order.current_status)) {
    return false;
  }

  // Calculate time difference
  const orderCreatedAt = new Date(order.created_at);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - orderCreatedAt.getTime();
  const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

  return timeDifferenceHours >= hoursThreshold;
};

/**
 * Get the time remaining before an order can be cancelled due to pending payment
 * @param order - The order to check
 * @param hoursThreshold - Number of hours to wait before allowing cancellation (default: 1)
 * @returns number of minutes remaining, or 0 if cancellation is already allowed
 */
export const getTimeRemainingForCancellation = (
  order: OrderData,
  hoursThreshold = 1
): number => {
  if (
    order.payment_status !== 'pending' ||
    ['cancelled', 'refunded'].includes(order.current_status)
  ) {
    return 0;
  }

  const orderCreatedAt = new Date(order.created_at);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - orderCreatedAt.getTime();
  const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

  if (timeDifferenceHours >= hoursThreshold) {
    return 0; // Can be cancelled now
  }

  const remainingHours = hoursThreshold - timeDifferenceHours;
  return Math.ceil(remainingHours * 60); // Return minutes remaining
};

/**
 * Format time remaining in a human-readable format
 * @param minutesRemaining - Number of minutes remaining
 * @returns formatted string
 */
export const formatTimeRemaining = (minutesRemaining: number): string => {
  if (minutesRemaining <= 0) {
    return 'Can be cancelled now';
  }

  const hours = Math.floor(minutesRemaining / 60);
  const minutes = minutesRemaining % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
};
