import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '@/contexts/ThemeContext';
import type {
  AppealTileDisabledReason,
  RejectionAllowedActions,
} from '@/types/itemRejectionRecovery';
import { visibleRecoveryActions } from '@/utils/itemRejectionRecovery';

export type RecoveryTileId =
  | 'aiFix'
  | 'retake'
  | 'condition'
  | 'editFields'
  | 'editPrice'
  | 'appeal';

const META: Record<
  RecoveryTileId,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; key: string; fallback: string }
> = {
  aiFix: { icon: 'auto-fix', key: 'business.items.recovery.action.aiFix', fallback: 'Fix photos with AI' },
  retake: { icon: 'camera-outline', key: 'business.items.recovery.action.retake', fallback: 'Retake photo' },
  condition: { icon: 'tag-outline', key: 'business.items.recovery.action.condition', fallback: 'Change condition' },
  editFields: { icon: 'pencil-outline', key: 'business.items.recovery.action.editFields', fallback: 'Edit item details' },
  editPrice: { icon: 'cash', key: 'business.items.recovery.action.editPrice', fallback: 'Edit price' },
  appeal: { icon: 'scale-balance', key: 'business.items.recovery.action.appeal', fallback: 'Appeal decision' },
};

type Props = {
  actions: RejectionAllowedActions;
  locked?: boolean;
  appealDisabledReason?: AppealTileDisabledReason;
  onAction: (id: RecoveryTileId) => void;
};

export function RecoveryActionTiles({
  actions,
  locked,
  appealDisabledReason,
  onAction,
}: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const tiles = visibleRecoveryActions(actions) as RecoveryTileId[];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tiles.map((id) => {
        const disabled = id === 'appeal' ? Boolean(appealDisabledReason) : Boolean(locked);
        const tooltip =
          id === 'appeal' && appealDisabledReason === 'in_review'
            ? t('business.items.recovery.appeal.disabledInReview', 'In review')
            : id === 'appeal' && appealDisabledReason
              ? t('business.items.recovery.appeal.disabledAllowance', '1 appeal per decision')
              : undefined;
        return (
          <Pressable
            key={id}
            disabled={disabled}
            onPress={() => onAction(id)}
            accessibilityLabel={tooltip || t(META[id].key, META[id].fallback)}
            style={[
              styles.tile,
              {
                marginRight: spacing.sm,
                padding: spacing.sm,
                borderRadius: borderRadius.lg,
                backgroundColor: colors.background.paper,
                borderWidth: id === 'appeal' ? StyleSheet.hairlineWidth : 0,
                borderColor: colors.divider,
                opacity: disabled ? 0.45 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons name={META[id].icon} size={22} color={colors.text.primary} />
            <Text variant="labelSmall" style={{ textAlign: 'center', marginTop: 6 }}>
              {t(META[id].key, META[id].fallback)}
            </Text>
            {tooltip ? (
              <Text variant="labelSmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                {tooltip}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'stretch', paddingVertical: 4 },
  tile: { width: 96, alignItems: 'center', minHeight: 88 },
});
