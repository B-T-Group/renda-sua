import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../common/BottomSheet';

type Props = {
  visible: boolean;
  children: ReactNode;
  bottomInset?: number;
};

/** Persistent sheet for the current delivery. Actions stay on the screen behind it. */
export function ActiveDeliveryView({ visible, children, bottomInset = 0 }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      visible={visible}
      onClose={() => undefined}
      persistent
      bottomInset={bottomInset}
      snapPoints={['34%', '78%']}
      title={t('agent.delivery.now', 'This delivery')}
    >
      {children}
    </BottomSheet>
  );
}
