import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useReelComments } from '../../hooks/useReelComments';
import { AppText } from '../common/AppText';
import { BottomSheet, BottomSheetTextInput } from '../common/BottomSheet';

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
    <BottomSheet
      visible={visible}
      onClose={onDismiss}
      snapPoints={['60%']}
      unwrapped
      footer={
        <View>
          <BottomSheetTextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('reels.comments.placeholder', 'Add a comment…')}
            maxLength={1000}
            style={[styles.input, { color: colors.text.primary, borderColor: colors.border }]}
          />
          <Button mode="contained" onPress={() => void onSubmit()} loading={submitting} style={{ marginTop: spacing.sm }}>
            {t('reels.comments.post', 'Post')}
          </Button>
        </View>
      }
    >
      <BottomSheetFlatList
        data={comments}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}
        ListHeaderComponent={
          <AppText role="h3" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
            {t('reels.comments.title', 'Comments')}
          </AppText>
        }
        ListEmptyComponent={loading ? null : <Text>{t('reels.comments.empty', 'No comments yet')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text variant="bodyMedium" style={{ color: colors.text.primary }}>{item.body}</Text>
          </View>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  row: { paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
});
