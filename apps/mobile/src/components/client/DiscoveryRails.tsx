import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { useClientFlags } from '@/contexts/ClientFlagsContext';
import {
  useCatalogExperience,
  type CatalogExperienceSurface,
} from '@/hooks/useCatalogExperience';
import { InventoryCatalogGridTile } from '../browse/InventoryCatalogGridTile';
import { RailSkeleton } from '../common/skeletons';
import { SectionHeader } from '../common/SectionHeader';

const RAIL_TILE_WIDTH = 160;
/** 4:5 photo plus a two-line title, price, hint, and rating. */
const RAIL_HEIGHT = 360;

type Props = {
  authenticated: boolean;
  countryCode?: string;
  surface?: CatalogExperienceSurface;
  onItemPress: (inventoryItemId: string) => void;
};

export function DiscoveryRails({
  authenticated,
  countryCode,
  surface = 'all',
  onItemPress,
}: Props) {
  const { flags } = useClientFlags();
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const { modules, loading } = useCatalogExperience(
    flags.catalog_experience_v1,
    authenticated,
    countryCode,
    surface
  );
  const visible =
    surface === 'all'
      ? modules
      : modules.filter((module) => module.type === 'RECENTLY_VIEWED');
  if (!flags.catalog_experience_v1) return null;
  if (loading && visible.length === 0) return <RailSkeleton />;
  if (visible.length === 0) return null;
  return (
    <View style={{ marginBottom: spacing.md }}>
      {visible.map((module) => (
        <View key={module.id} style={{ marginBottom: spacing.lg }}>
          <SectionHeader title={module.title || t('client.home.forYou', 'For you')} />
          <FlashList
            horizontal
            data={module.products.slice(0, 8)}
            keyExtractor={(product) => product.id}
            style={{ height: RAIL_HEIGHT }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.md }}
            renderItem={({ item: product }) => (
              <View style={{ width: RAIL_TILE_WIDTH, marginRight: spacing.sm }}>
                <InventoryCatalogGridTile item={product} onPress={onItemPress} />
              </View>
            )}
          />
        </View>
      ))}
    </View>
  );
}
