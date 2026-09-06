import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';

export function AgentLocationDisclosureContent() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const bodyStyle = { color: colors.text.primary, lineHeight: 22 };
  const sectionTitleStyle = { color: colors.text.primary, fontWeight: '600' as const, marginTop: spacing.md };
  const bulletStyle = { color: colors.text.secondary, lineHeight: 22, marginTop: spacing.xs };

  return (
    <View style={styles.root}>
      <Text variant="bodyMedium" style={bodyStyle}>
        {t(
          'agent.locationTracking.disclosureProminent',
          'Rendasua collects, transmits, and stores your device\'s precise location data to enable finding nearby open delivery orders and live delivery tracking for customers—including when the app is closed or not in use if you allow background location access.'
        )}
      </Text>

      <Text variant="titleSmall" style={sectionTitleStyle}>
        {t('agent.locationTracking.disclosureHowUsedTitle', 'How your location is used')}
      </Text>
      <Text variant="bodyMedium" style={bulletStyle}>
        {`• ${t(
          'agent.locationTracking.disclosureRestrictionClaim',
          'Claiming orders: you must accept this disclosure and enable location permissions to claim delivery orders.'
        )}`}
      </Text>
      <Text variant="bodyMedium" style={bulletStyle}>
        {`• ${t(
          'agent.locationTracking.disclosureRestrictionNearby',
          'Nearby orders: you will not receive notifications about nearby open orders unless location is enabled.'
        )}`}
      </Text>
      <Text variant="bodyMedium" style={bulletStyle}>
        {`• ${t(
          'agent.locationTracking.disclosureUseCaseNearbyFull',
          'Nearby orders: to show open orders near you when you browse available deliveries.'
        )}`}
      </Text>
      <Text variant="bodyMedium" style={bulletStyle}>
        {`• ${t(
          'agent.locationTracking.disclosureUseCaseDeliveryFull',
          'Active deliveries: to share your live position with customers on orders you are delivering, including while the app runs in the background if you grant background access.'
        )}`}
      </Text>

      <Text variant="titleSmall" style={sectionTitleStyle}>
        {t('agent.locationTracking.disclosureSharingTitle', 'How your location is shared')}
      </Text>
      <Text variant="bodyMedium" style={bulletStyle}>
        {t(
          'agent.locationTracking.disclosureSharingBody',
          'Location data is sent to Rendasua servers and shared with customers only for orders you are delivering or viewing. It is not used for advertising.'
        )}
      </Text>

      <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: spacing.md, lineHeight: 20 }}>
        {t(
          'agent.locationTracking.disclosureConsentNote',
          'Tap “Continue” below to proceed. You can change location access anytime in your device settings.'
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 4 },
});
