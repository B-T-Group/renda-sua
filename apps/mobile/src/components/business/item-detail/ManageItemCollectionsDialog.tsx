import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Dialog, Portal, Text } from 'react-native-paper';
import { useBusinessItemCollections } from '../../../hooks/business/useBusinessItemCollections';
import { useLanguage } from '../../../hooks/useLanguage';

type Props = {
  visible: boolean;
  itemId: string;
  onDismiss: () => void;
  onSaved?: () => void;
};

export function ManageItemCollectionsDialog({ visible, itemId, onDismiss, onSaved }: Props) {
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { collections, suggestions, loading, saving, error, saveCollections } =
    useBusinessItemCollections(itemId, visible);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set(collections.filter((c) => c.assigned).map((c) => c.id)));
  }, [collections, visible]);

  const labelFor = (c: { name_en: string; name_fr: string }) =>
    currentLanguage === 'fr' ? c.name_fr : c.name_en;

  const suggestedIds = useMemo(() => new Set(suggestions.map((s) => s.collectionId)), [suggestions]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySuggestions = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of suggestions) next.add(s.collectionId);
      return next;
    });
  };

  const handleSave = async () => {
    const ok = await saveCollections([...selected]);
    if (ok) {
      onSaved?.();
      onDismiss();
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={saving ? undefined : onDismiss}>
        <Dialog.Title>{t('business.items.collections.title', 'Collections')}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scroll}>
          <ScrollView>
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}
            {loading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} />
            ) : (
              <>
                {suggestions.length > 0 ? (
                  <View style={styles.block}>
                    <Text variant="labelLarge">
                      {t('business.items.collections.suggestions', 'Suggested')}
                    </Text>
                    <View style={styles.chips}>
                      {suggestions.map((s) => (
                        <Chip key={s.collectionId} compact style={styles.chip}>
                          {labelFor(s)}
                        </Chip>
                      ))}
                    </View>
                    <Button mode="text" onPress={applySuggestions}>
                      {t('business.items.collections.applySuggestions', 'Apply suggestions')}
                    </Button>
                  </View>
                ) : null}
                <View style={styles.chips}>
                  {collections.map((c) => (
                    <Chip
                      key={c.id}
                      selected={selected.has(c.id)}
                      onPress={() => toggle(c.id)}
                      style={styles.chip}
                      icon={suggestedIds.has(c.id) ? 'star-outline' : undefined}
                    >
                      {labelFor(c)}
                    </Chip>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} disabled={saving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button mode="contained" loading={saving} onPress={() => void handleSave()}>
            {t('common.save', 'Save')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 400, paddingHorizontal: 8 },
  block: { marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { marginBottom: 4 },
  error: { color: '#dc2626', marginBottom: 8 },
});
