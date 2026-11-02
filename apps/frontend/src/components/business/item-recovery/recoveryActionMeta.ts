import type { RejectionAllowedActions } from '../../../types/itemRejectionRecovery';

export type RecoveryTileId = Exclude<
  keyof RejectionAllowedActions,
  'resubmit'
>;

export const RECOVERY_TILE_META: Record<
  RecoveryTileId,
  { labelKey: string; defaultLabel: string; icon: string }
> = {
  aiFix: {
    labelKey: 'business.items.recovery.action.aiFix',
    defaultLabel: 'Fix photos with AI',
    icon: 'auto_awesome',
  },
  retake: {
    labelKey: 'business.items.recovery.action.retake',
    defaultLabel: 'Retake photo',
    icon: 'photo_camera',
  },
  condition: {
    labelKey: 'business.items.recovery.action.condition',
    defaultLabel: 'Change condition',
    icon: 'sell',
  },
  editFields: {
    labelKey: 'business.items.recovery.action.editFields',
    defaultLabel: 'Edit item details',
    icon: 'edit',
  },
  editPrice: {
    labelKey: 'business.items.recovery.action.editPrice',
    defaultLabel: 'Edit price',
    icon: 'payments',
  },
  appeal: {
    labelKey: 'business.items.recovery.action.appeal',
    defaultLabel: 'Appeal decision',
    icon: 'balance',
  },
};
