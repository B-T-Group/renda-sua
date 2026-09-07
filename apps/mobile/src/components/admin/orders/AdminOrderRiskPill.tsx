import { useTranslation } from 'react-i18next';
import { StatusPill } from '../../common/StatusPill';
import { useTheme } from '../../../contexts/ThemeContext';
import type { AdminOrderRiskLevel } from '../../../types/adminOrders';
import { severityLabel } from '../../../utils/adminOrderRisk';

export interface AdminOrderRiskPillProps {
  level: AdminOrderRiskLevel;
  compact?: boolean;
}

export function AdminOrderRiskPill({ level, compact }: AdminOrderRiskPillProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const palette =
    level === 'critical'
      ? {
          backgroundColor: colors.errorTint,
          textColor: colors.error.main,
          icon: 'alert-octagon' as const,
        }
      : level === 'warning'
        ? {
            backgroundColor: colors.warningTint,
            textColor: colors.warning.dark,
            icon: 'alert' as const,
          }
        : {
            backgroundColor: colors.successTint,
            textColor: colors.success.main,
            icon: 'check-circle' as const,
          };

  return (
    <StatusPill
      label={severityLabel(t, level)}
      backgroundColor={palette.backgroundColor}
      textColor={palette.textColor}
      icon={palette.icon}
      compact={compact}
      leadingDot={level === 'critical'}
    />
  );
}
