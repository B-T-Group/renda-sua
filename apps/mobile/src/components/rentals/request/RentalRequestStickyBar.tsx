import { useTranslation } from 'react-i18next';
import { StickyActionCard } from '../../common/StickyActionCard';

export interface RentalRequestStickyBarProps {
  totalAmount: string;
  sendLabel: string;
  sendIcon: string;
  sendDisabled: boolean;
  sending: boolean;
  onSend: () => void;
  previousAmount?: string;
  legal?: string;
  blockedReason?: string;
}

export function RentalRequestStickyBar({
  totalAmount,
  sendLabel,
  sendIcon,
  sendDisabled,
  sending,
  onSend,
  previousAmount,
  legal,
  blockedReason,
}: RentalRequestStickyBarProps) {
  const { t } = useTranslation();
  return (
    <StickyActionCard
      testID="rental-request-sticky"
      summaryLabel={t('rentals.requestForm.total', 'Total')}
      summaryValue={totalAmount}
      summaryPrevious={previousAmount}
      summaryValueTestID="rental-request-total"
      note={blockedReason ?? legal ?? t('rentals.searchFirst.nothingCharged', 'Nothing is charged until the business accepts.')}
      noteTone={blockedReason ? 'warning' : 'default'}
      actionLabel={sendLabel}
      actionIcon={sendIcon}
      actionTestID="rental-request-send"
      disabled={sendDisabled}
      loading={sending}
      onAction={onSend}
    />
  );
}
