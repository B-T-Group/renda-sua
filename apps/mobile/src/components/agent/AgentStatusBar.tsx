import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { observer } from 'mobx-react-lite';
import { Portal, Snackbar, Switch, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { useAgentLocationOptional } from '../../contexts/AgentLocationContext';
import { useAgentAvailability } from '../../hooks/useAgentAvailability';
import { useAgentFocus } from '../../hooks/useAgentFocus';
import { StatusPill } from '../common/StatusPill';

/**
 * Online/Offline status bar shown at the top of all agent screens.
 * - Green: online and available for deliveries
 * - Orange: location off or unavailable
 */
export const AgentStatusBar = observer(function AgentStatusBar() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<{ navigate: (route: string) => void }>();
  const location = useAgentLocationOptional();
  const availability = useAgentAvailability();
  const { showDelivery } = useAgentFocus(availability.enabled);

  const onToggleAvailable = useCallback(
    (next: boolean) => {
      void availability.setAvailable(next).catch(() => {});
    },
    [availability]
  );

  const goToTracking = useCallback(() => {
    navigation.navigate('AgentLocationTracking');
  }, [navigation]);

  if (!availability.enabled || !showDelivery) return null;

  const trackingActive =
    !!location?.isTrackingActive && location?.consent === 'accepted';
  const isOnline = availability.available && trackingActive;
  const toneColors = isOnline ? colors.success : colors.warning;

  const barStyle = [
    styles.bar,
    {
      backgroundColor: toneColors.main + '14',
      borderBottomColor: toneColors.main + '40',
      paddingHorizontal: spacing.md,
    },
  ];

  if (!trackingActive) {
    return (
      <>
        <Pressable onPress={goToTracking} style={barStyle}>
          <View style={styles.statusCluster}>
            <StatusPill
              compact
              leadingDot
              label={t(
                'agent.statusBar.trackingOffTitle',
                'Location sharing is off'
              )}
              backgroundColor={colors.warning.main + '22'}
              textColor={colors.warning.dark}
              style={styles.pillAlign}
            />
          </View>
          <Text
            variant="labelSmall"
            style={[styles.action, { color: colors.warning.dark }]}
          >
            {t('agent.statusBar.enableCta', 'Enable →')}
          </Text>
        </Pressable>
        <Portal>
          <Snackbar
            visible={!!availability.error}
            onDismiss={availability.clearError}
            duration={4000}
          >
            {availability.error ?? ''}
          </Snackbar>
        </Portal>
      </>
    );
  }

  const statusLabel = availability.available
    ? t('agent.statusBar.online', 'Online')
    : t('agent.statusBar.offline', 'Offline');
  const detailLabel = availability.available
    ? t('agent.statusBar.availableForDeliveries', 'Available for deliveries')
    : t('agent.statusBar.unavailableSubtitle', "You won't receive new orders");

  return (
    <>
      <View style={barStyle}>
        <View style={styles.statusCluster}>
          <StatusPill
            compact
            leadingDot
            label={statusLabel}
            backgroundColor={
              isOnline ? colors.success.main + '22' : colors.warning.main + '22'
            }
            textColor={isOnline ? colors.success.dark : colors.warning.dark}
            style={styles.pillAlign}
          />
          <Text
            variant="bodySmall"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.detail, { color: colors.text.secondary }]}
          >
            {detailLabel}
          </Text>
        </View>
        <Switch
          value={availability.available}
          onValueChange={onToggleAvailable}
          disabled={availability.saving}
          color={colors.success.main}
          style={styles.switch}
        />
      </View>
      <Portal>
        <Snackbar
          visible={!!availability.error}
          onDismiss={availability.clearError}
          duration={4000}
        >
          {availability.error ?? ''}
        </Snackbar>
      </Portal>
    </>
  );
});

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusCluster: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillAlign: {
    alignSelf: 'center',
  },
  detail: {
    flex: 1,
    minWidth: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 16,
  },
  action: {
    fontWeight: '700',
    flexShrink: 0,
  },
  switch: {
    flexShrink: 0,
    transform: [{ scaleX: 0.92 }, { scaleY: 0.92 }],
  },
});
