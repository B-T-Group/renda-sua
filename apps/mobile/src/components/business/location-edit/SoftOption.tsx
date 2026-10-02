import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { LocationOptionArt, type LocationArtKind } from './LocationOptionArt';

type Props = {
  art: LocationArtKind;
  title: string;
  line: string;
  help: string;
  children?: React.ReactNode;
};

/** One setting: a picture, a short line, and a help button for the rest. */
export function SoftOption({ art, title, line, help, children }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [open, setOpen] = useState(false);
  const learnMore = t('business.locations.editPage.learnMore', 'Learn more');

  return (
    <View
      style={[
        styles.card,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.head, { gap: spacing.md }]}>
        <LocationOptionArt kind={art} />
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text variant="titleMedium" style={{ color: colors.text.primary, flex: 1 }}>
              {title}
            </Text>
            <IconButton
              icon="help-circle-outline"
              size={22}
              onPress={() => setOpen(true)}
              accessibilityLabel={`${learnMore}: ${title}`}
              style={styles.help}
            />
          </View>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, lineHeight: 22 }}>
            {line}
          </Text>
        </View>
      </View>
      {children ? <View style={{ gap: spacing.md }}>{children}</View> : null}
      <HelpDialog
        visible={open}
        title={title}
        body={help}
        closeLabel={t('common.gotIt', 'Got it')}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function HelpDialog({
  visible,
  title,
  body,
  closeLabel,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onClose}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{body}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>{closeLabel}</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  card: {},
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  copy: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  help: { margin: 0 },
});
