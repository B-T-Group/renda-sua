import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { ExportOrderIllustration } from '../../components/illustrations/ExportOrderIllustration';
import type { ClientRootStackParamList } from '../../navigation/types';

const STEPS = [
  { key: 'review', title: 'We review your request', body: 'Our export team checks the item, quantity and destination. We may ask you for changes.' },
  { key: 'proforma', title: 'You receive a proforma', body: 'We confirm the manufacturer quote and send you a proforma invoice to approve.' },
  { key: 'deposit', title: 'Approve and pay the deposit', body: 'Once you approve the proforma, pay the deposit to start production.' },
  { key: 'delivery', title: 'Pay the balance and receive your goods', body: 'After production you settle the balance and we ship your order to you.' },
] as const;

type Params = { ExportOrderSubmitted: ClientRootStackParamList['ExportOrderSubmitted'] };

export default function ExportOrderSubmittedScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { orderId, bcNumber } = useRoute<RouteProp<Params, 'ExportOrderSubmitted'>>().params;

  useLayoutEffect(() => {
    navigation.setOptions({ headerBackVisible: false, headerLeft: () => null, gestureEnabled: false });
  }, [navigation]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.md }}>
        <View style={styles.center}>
          <ExportOrderIllustration label={t('exportOrders.submitted.illustration', 'Purchase order received')} />
          <Text variant="headlineSmall" style={styles.title}>
            {t('exportOrders.submitted.title', 'Request received')}
          </Text>
          {bcNumber ? (
            <Text testID="export-submitted-bc" variant="titleSmall" style={{ color: colors.primary.main }}>
              {t('exportOrders.submitted.bcLabel', 'Purchase order {{bc}}', { bc: bcNumber })}
            </Text>
          ) : null}
          <Text style={[styles.intro, { color: colors.text.secondary }]}>
            {t('exportOrders.submitted.intro', 'We issued your purchase order. Here is what happens next.')}
          </Text>
        </View>
        <View style={{ padding: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.primaryTint, gap: spacing.sm }}>
          {STEPS.map((step, i) => (
            <View key={step.key} testID={`export-step-${step.key}`}>
              <Text variant="titleSmall">{`${i + 1}. ${t(`exportOrders.submitted.steps.${step.key}.title`, step.title)}`}</Text>
              <Text style={{ color: colors.text.secondary }}>
                {t(`exportOrders.submitted.steps.${step.key}.body`, step.body)}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View
        style={{
          padding: spacing.md,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          gap: spacing.xs,
        }}
      >
        <Button
          testID="export-submitted-view-order"
          mode="contained"
          onPress={() => navigation.replace('ClientExportOrderDetail', { orderId })}
        >
          {t('exportOrders.submitted.viewOrder', 'View my order')}
        </Button>
        <Button
          testID="export-submitted-browse"
          mode="outlined"
          onPress={() => navigation.navigate('ClientMainTabs', { screen: 'ClientBrowse' })}
        >
          {t('exportOrders.submitted.keepBrowsing', 'Keep browsing')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', marginBottom: 16 },
  title: { fontWeight: '800', marginTop: 8, textAlign: 'center' },
  intro: { textAlign: 'center', marginTop: 6 },
});
