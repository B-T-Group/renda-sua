import { useTranslation } from 'react-i18next';
import { CatalogShortcutButton } from './CatalogShortcutButton';

type Lane = 'shop' | 'food' | 'exports';

export function CatalogLaneShortcut({
  lane,
  onPress,
}: {
  lane: Lane;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const isExport = lane === 'exports';
  const label = isExport
    ? t('catalogShortcut.myExports', 'My exports')
    : t('catalogShortcut.myOrders', 'My orders');
  return (
    <CatalogShortcutButton
      icon={isExport ? 'airplane' : 'clipboard-text-outline'}
      label={label}
      onPress={onPress}
      testID={isExport ? 'catalog-my-exports' : 'catalog-my-orders'}
    />
  );
}
