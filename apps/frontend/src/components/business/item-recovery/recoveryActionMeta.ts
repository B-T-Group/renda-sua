import type { RecoveryTileId } from '../../../types/itemRejectionRecovery';

export type { RecoveryTileId };

export const RECOVERY_TILE_META: Record<
  Exclude<RecoveryTileId, 'resubmit'>,
  { labelKey: string; defaultLabel: string; icon: string }
> = {
  ai_fix: {
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
  edit_fields: {
    labelKey: 'business.items.recovery.action.editFields',
    defaultLabel: 'Edit item details',
    icon: 'edit',
  },
  edit_price: {
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
