import { AdminPanelSettings, CheckCircle } from '@mui/icons-material';
import { Chip, ChipProps } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * StatusBadge Component
 *
 * A reusable badge component for displaying user status indicators.
 * Supports two types of badges:
 * - 'verified': Shows a green checkmark badge for verified users
 * - 'admin': Shows a blue admin badge for admin users
 *
 * @param type - The type of badge to display ('verified' | 'admin')
 * @param size - The size of the badge ('small' | 'medium')
 * @param variant - The visual variant ('filled' | 'outlined')
 * @param sx - Additional Material-UI styling props
 */
interface StatusBadgeProps {
  type: 'verified' | 'admin';
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
  sx?: ChipProps['sx'];
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  type,
  size = 'small',
  variant = 'filled',
  sx,
}) => {
  const { t } = useTranslation();

  const getBadgeConfig = () => {
    switch (type) {
      case 'verified':
        return {
          icon: <CheckCircle fontSize="small" />,
          label: t('common.verified'),
          color: 'success' as const,
        };
      case 'admin':
        return {
          icon: <AdminPanelSettings fontSize="small" />,
          label: t('common.admin'),
          color: 'primary' as const,
        };
      default:
        return {
          icon: <CheckCircle fontSize="small" />,
          label: t('common.verified'),
          color: 'success' as const,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <Chip
      icon={config.icon}
      label={config.label}
      color={config.color}
      size={size}
      variant={variant}
      sx={{
        fontWeight: 600,
        '& .MuiChip-icon': {
          color: 'inherit',
        },
        ...sx,
      }}
    />
  );
};

export default StatusBadge;
