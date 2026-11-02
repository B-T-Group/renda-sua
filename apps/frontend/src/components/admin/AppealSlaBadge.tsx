import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SlaState } from '../../types/itemRejectionRecovery';
import { slaBadgeTone } from '../../utils/itemRejectionRecovery';

type Props = {
  state?: SlaState | null;
  dueAt?: string | null;
};

export function AppealSlaBadge({ state, dueAt }: Props) {
  const { t } = useTranslation();
  if (!state) return null;
  const color = slaBadgeTone(state);
  const label = slaLabel(state, dueAt, t);
  return (
    <Chip
      size="small"
      color={color === 'default' ? 'default' : color}
      label={label}
    />
  );
}

function slaLabel(
  state: SlaState,
  dueAt: string | null | undefined,
  t: (key: string, fallback: string) => string
): string {
  if (state === 'breached') {
    return t('admin.itemAppeals.slaBreached', 'SLA breached');
  }
  if (state === 'warning') {
    return t('admin.itemAppeals.slaWarning', 'SLA due soon');
  }
  if (dueAt) {
    return t('admin.itemAppeals.slaOk', 'Due {{when}}').replace(
      '{{when}}',
      new Date(dueAt).toLocaleString()
    );
  }
  return t('admin.itemAppeals.slaOkShort', 'On track');
}
