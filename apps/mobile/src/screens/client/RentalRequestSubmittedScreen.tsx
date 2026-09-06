import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { ClientRootStackParamList } from '../../navigation/types';

type Params = { RentalRequestSubmitted: { requestId?: string } };

const STEPS = [
  {
    icon: 'file-document-outline' as const,
    titleKey: 'rentals.requestSubmitted.contractTitle',
    titleDefault: 'Contract and payment',
    bodyKey: 'rentals.requestSubmitted.contractBody',
    bodyDefault:
      'The owner will review your request and, if the item is available, propose a contract.',
  },
  {
    icon: 'numeric' as const,
    titleKey: 'rentals.requestSubmitted.pinTitle',
    titleDefault: 'Starting the rental',
    bodyKey: 'rentals.requestSubmitted.pinBody',
    bodyDefault: 'When you meet the owner, give them your start PIN to confirm handover.',
  },
  {
    icon: 'cash-check' as const,
    titleKey: 'rentals.requestSubmitted.payoutTitle',
    titleDefault: 'Funds to the owner',
    bodyKey: 'rentals.requestSubmitted.payoutBody',
    bodyDefault: 'Payment is released to the owner once the rental period ends.',
  },
  {
    icon: 'star-outline' as const,
    titleKey: 'rentals.requestSubmitted.ratingsTitle',
    titleDefault: 'After the rental ends',
    bodyKey: 'rentals.requestSubmitted.ratingsBody',
    bodyDefault: 'You will be able to rate the owner and the rented item.',
  },
];

export default function RentalRequestSubmittedScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  useRoute<RouteProp<Params, 'RentalRequestSubmitted'>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  const goDashboard = () =>
    navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' });
  const goRequests = () => navigation.navigate('ClientMyRentals');

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <MaterialCommunityIcons
            name="check-circle"
            size={56}
            color={colors.success.main}
          />
          <Text
            style={[
              typography.h5,
              {
                color: colors.text.primary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            {t(
              'rentals.requestSubmitted.headline',
              'Your rental request was submitted'
            )}
          </Text>
          <Text
            style={[
              typography.body2,
              {
                color: colors.text.secondary,
                textAlign: 'center',
                marginTop: spacing.xs,
              },
            ]}
          >
            {t(
              'rentals.requestSubmitted.intro',
              'Here is what happens next on Rendasua.'
            )}
          </Text>
        </View>

        {STEPS.map((step) => (
          <View
            key={step.titleKey}
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <View style={styles.row}>
              <MaterialCommunityIcons
                name={step.icon}
                size={22}
                color={colors.primary.main}
              />
              <Text
                style={[
                  typography.subtitle2,
                  {
                    color: colors.text.primary,
                    marginLeft: spacing.sm,
                    flex: 1,
                  },
                ]}
              >
                {t(step.titleKey, step.titleDefault)}
              </Text>
            </View>
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, marginTop: spacing.xs },
              ]}
            >
              {t(step.bodyKey, step.bodyDefault)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          backgroundColor: colors.pageBackground,
          gap: spacing.xs,
        }}
      >
        <Button mode="contained" onPress={goDashboard}>
          {t(
            'rentals.requestSubmitted.returnToDashboard',
            'Return to dashboard'
          )}
        </Button>
        <Button mode="text" onPress={goRequests}>
          {t('rentals.requestSubmitted.viewRequests', 'My rental requests')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
