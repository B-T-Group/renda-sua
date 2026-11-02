import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BalanceIcon from '@mui/icons-material/Balance';
import EditIcon from '@mui/icons-material/Edit';
import PaymentsIcon from '@mui/icons-material/Payments';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SellIcon from '@mui/icons-material/Sell';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RejectionAllowedActions } from '../../../types/itemRejectionRecovery';
import type { AppealTileDisabledReason } from '../../../types/itemRejectionRecovery';
import { visibleRecoveryActions } from '../../../utils/itemRejectionRecovery';
import { RECOVERY_TILE_META, type RecoveryTileId } from './recoveryActionMeta';

const ICONS: Record<RecoveryTileId, ReactNode> = {
  aiFix: <AutoAwesomeIcon />,
  retake: <PhotoCameraIcon />,
  condition: <SellIcon />,
  editFields: <EditIcon />,
  editPrice: <PaymentsIcon />,
  appeal: <BalanceIcon />,
};

type Props = {
  actions: RejectionAllowedActions;
  locked?: boolean;
  appealDisabledReason?: AppealTileDisabledReason;
  onAction: (id: RecoveryTileId) => void;
};

export function RecoveryActionTiles({
  actions,
  locked = false,
  appealDisabledReason,
  onAction,
}: Props) {
  const { t } = useTranslation();
  const tiles = visibleRecoveryActions(actions) as RecoveryTileId[];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        pb: 0.5,
        mx: { xs: -0.5, sm: 0 },
        px: { xs: 0.5, sm: 0 },
      }}
    >
      {tiles.map((id) => (
        <RecoveryTile
          key={id}
          id={id}
          label={t(RECOVERY_TILE_META[id].labelKey, RECOVERY_TILE_META[id].defaultLabel)}
          disabled={isTileDisabled(id, locked, appealDisabledReason)}
          tooltip={appealTooltip(id, appealDisabledReason, t)}
          secondary={id === 'appeal'}
          onClick={() => onAction(id)}
        />
      ))}
    </Box>
  );
}

function isTileDisabled(
  id: RecoveryTileId,
  locked: boolean,
  appealDisabledReason?: AppealTileDisabledReason
): boolean {
  if (id === 'appeal') return Boolean(appealDisabledReason);
  return locked;
}

function appealTooltip(
  id: RecoveryTileId,
  reason: AppealTileDisabledReason | undefined,
  t: (key: string, fallback: string) => string
): string | undefined {
  if (id !== 'appeal' || !reason) return undefined;
  if (reason === 'in_review') {
    return t('business.items.recovery.appeal.disabledInReview', 'In review');
  }
  return t(
    'business.items.recovery.appeal.disabledAllowance',
    '1 appeal per decision'
  );
}

function RecoveryTile({
  id,
  label,
  disabled,
  tooltip,
  secondary,
  onClick,
}: {
  id: RecoveryTileId;
  label: string;
  disabled: boolean;
  tooltip?: string;
  secondary?: boolean;
  onClick: () => void;
}) {
  const tile = (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      sx={{
        minWidth: 92,
        maxWidth: 120,
        px: 1,
        py: 1.25,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        alignItems: 'center',
        bgcolor: secondary ? 'transparent' : 'action.hover',
        opacity: disabled ? 0.5 : 1,
        border: secondary ? 1 : 0,
        borderColor: 'divider',
        borderStyle: secondary ? 'dashed' : 'solid',
      }}
    >
      {ICONS[id]}
      <Typography variant="caption" align="center" sx={{ lineHeight: 1.25 }}>
        {label}
      </Typography>
    </ButtonBase>
  );
  if (!tooltip) return tile;
  return <Tooltip title={tooltip}>{tile}</Tooltip>;
}
