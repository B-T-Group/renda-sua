import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useReelComments } from '../../hooks/useReelComments';

interface Props {
  visible: boolean;
  reelId: string;
  onDismiss: () => void;
}

export function ReelCommentsSheet({ visible, reelId, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { comments, loading, submit } = useReelComments(reelId, visible);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await submit(draft.trim());
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.sheet,
          { backgroundColor: colors.surface, padding: spacing.md },
        ]}
      >
        <Text variant="titleMedium">{t('reels.comments.title', 'Comments')}</Text>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 280, marginVertical: spacing.sm }}
          ListEmptyComponent={
            loading ? null : (
              <Text>{t('reels.comments.empty', 'No comments yet')}</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text variant="bodyMedium">{item.body}</Text>
            </View>
          )}
        />
        <TextInput
          mode="outlined"
          value={draft}
          onChangeText={setDraft}
          placeholder={t('reels.comments.placeholder', 'Add a comment…')}
          maxLength={1000}
        />
        <Button
          mode="contained"
          onPress={() => void onSubmit()}
          loading={submitting}
          style={{ marginTop: spacing.sm }}
        >
          {t('reels.comments.post', 'Post')}
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 20, borderRadius: 16 },
  row: { paddingVertical: 8 },
});
