import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from 'react-native-paper';

type Props = {
  onCollections: () => void;
  onRefineAi: () => void;
};

export function ItemDetailToolsRow({ onCollections, onRefineAi }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <Button mode="outlined" icon="folder-multiple" onPress={onCollections} style={styles.btn}>
        {t('business.items.collections.title', 'Collections')}
      </Button>
      <Button mode="outlined" icon="auto-fix" onPress={onRefineAi} style={styles.btn}>
        {t('business.items.refineWithAi.title', 'Refine with AI')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btn: { flexGrow: 1 },
});
