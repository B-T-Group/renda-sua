import type { Theme } from '../../theme';
import type { RentalPhase } from './rentalPhase';

export function rentalPhaseColors(
  phase: RentalPhase,
  colors: Theme['colors']
): { backgroundColor: string; textColor: string; borderColor: string } {
  switch (phase) {
    case 'offer_ready':
    case 'ready_for_pickup':
    case 'in_progress':
      return {
        backgroundColor: colors.success.main + '22',
        textColor: colors.success.dark ?? colors.success.main,
        borderColor: colors.success.main + '55',
      };
    case 'requested':
    case 'reserved':
      return {
        backgroundColor: colors.warning.main + '22',
        textColor: colors.warning.dark ?? colors.warning.main,
        borderColor: colors.warning.main + '55',
      };
    case 'done':
      return {
        backgroundColor: colors.info.main + '18',
        textColor: colors.info.main,
        borderColor: colors.info.main + '44',
      };
    default:
      return {
        backgroundColor: colors.divider,
        textColor: colors.text.secondary,
        borderColor: colors.divider,
      };
  }
}
