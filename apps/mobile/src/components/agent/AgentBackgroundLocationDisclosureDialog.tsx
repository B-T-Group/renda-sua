import React from 'react';
import { Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { AgentLocationDisclosureContent } from './AgentLocationDisclosureContent';

const PRIVACY_POLICY_URL = 'https://rendasua.com/privacy';

export interface AgentBackgroundLocationDisclosureDialogProps {
  visible: boolean;
  permissionLoading?: boolean;
  onContinue: () => void;
}

export function AgentBackgroundLocationDisclosureDialog({
  visible,
  permissionLoading,
  onContinue,
}: AgentBackgroundLocationDisclosureDialogProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const scrollMaxHeight = Math.min(height * 0.52, 480);

  return (
    <Portal>
      <Dialog visible={visible} dismissable={false}>
        <Dialog.Title style={{ color: colors.text.primary }}>
          {t('agent.locationTracking.disclosureTitle', 'Location data disclosure')}
        </Dialog.Title>
        <Dialog.ScrollArea style={[styles.scrollArea, { maxHeight: scrollMaxHeight }]}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.scrollContent}
          >
            <AgentLocationDisclosureContent />
            <Text
              variant="bodySmall"
              style={[styles.privacyLink, { color: colors.primary.main }]}
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            >
              {t('agent.locationTracking.privacyPolicyLink', 'Privacy Policy')}
            </Text>
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <Button mode="contained" loading={permissionLoading} disabled={permissionLoading} onPress={onContinue}>
            {t('agent.locationTracking.disclosureContinue', 'Continue')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  scrollArea: { paddingHorizontal: 0 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 8 },
  privacyLink: { marginTop: 16, textDecorationLine: 'underline' },
  actions: { flexWrap: 'wrap', justifyContent: 'flex-end' },
});
