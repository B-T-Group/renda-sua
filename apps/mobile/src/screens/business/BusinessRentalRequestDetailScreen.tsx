import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessRentalRespondDialog } from '../../components/business/rentals/BusinessRentalRespondDialog';
import {
  CardBody,
  RequestDecisionButtons,
  requestThumbUri,
} from '../../components/business/rentals/BusinessRentalRequestCard';
import { useTheme } from '../../contexts/ThemeContext';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessRentalRequestRow } from '../../types/rentals';
import { buildRequestCardModel } from '../../utils/rentals/rentalRequestCardModel';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalRequestDetail'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export default function BusinessRentalRequestDetailScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [request, setRequest] = useState<BusinessRentalRequestRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [mode, setMode] = useState<'available' | 'unavailable' | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await rentalsApi.getBusinessRequests({ id: route.params.requestId });
      const row = rows.find((item) => item.id === route.params.requestId) ?? null;
      setRequest(row);
      setMissing(!row);
    } catch {
      setMissing(true);
    }
  }, [route.params.requestId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const model = request ? buildRequestCardModel(request, i18n.language, new Date(), t) : null;
  const pending = request?.status === 'pending';

  return (
    <View style={[styles.screen, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
      <View style={[styles.header, { paddingHorizontal: spacing.md }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back', 'Back')} onPress={() => navigation.goBack()} hitSlop={8}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text.primary} />
        </Pressable>
        <View style={styles.flex}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '800' }}>
            {t('rentals.requestCard.title', 'Request')}
          </Text>
          {model ? (
            <Text numberOfLines={1} style={{ color: colors.text.secondary }}>
              {model.itemName}
            </Text>
          ) : null}
        </View>
      </View>
      {!request && !missing ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary.main} />
      ) : null}
      {missing && !request ? (
        <Text style={{ color: colors.text.secondary, margin: spacing.md }}>
          {t('rentals.requestCard.notFound', 'This request is no longer available.')}
        </Text>
      ) : null}
      {request && model ? (
        <ScrollView contentContainerStyle={{ paddingBottom: pending ? 140 : spacing.lg }}>
          <CardBody model={model} imageUri={requestThumbUri(request)} fullNote sections />
        </ScrollView>
      ) : null}
      {request && model && pending ? (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={{ color: colors.text.secondary, textAlign: 'center', marginBottom: 8, fontSize: 12 }}>
            {t('rentals.requestCard.chargedAfterAccept', 'The renter is charged only after you accept.')}
          </Text>
          <RequestDecisionButtons
            requestId={request.id}
            acceptDisabled={model.acceptDisabled}
            onAccept={() => setMode('available')}
            onDecline={() => setMode('unavailable')}
          />
        </View>
      ) : null}
      <BusinessRentalRespondDialog
        visible={!!mode && !!request}
        mode={mode}
        request={request}
        onDismiss={() => setMode(null)}
        onSuccess={() => {
          setMode(null);
          void load();
        }}
        onStale={() => {
          setMode(null);
          void load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  flex: { flex: 1, minWidth: 0 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 8, paddingHorizontal: 12 },
});
