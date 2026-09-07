import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { businessApi } from '../../../services/businessApi';
import type { BusinessLocation } from '../../../types/business/locations';
import type { BusinessRootStackParamList } from '../../../navigation/types';
import { useTheme } from '../../../contexts/ThemeContext';
import { KeyboardAwareScrollView } from '../../layout/KeyboardAwareScrollView';
import type { AiReviewFormValues } from './AddItemAiReviewStep';

type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export interface AddItemPublishStepProps {
  values: AiReviewFormValues;
  busy: boolean;
  initialLocationId?: string;
  onChange: (values: AiReviewFormValues) => void;
  onPublish: () => void;
  onSaveForLater: () => void;
}

export function AddItemPublishStep({
  values,
  busy,
  initialLocationId,
  onChange,
  onPublish,
  onSaveForLater,
}: AddItemPublishStepProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<Nav>();
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(true);

  const patch = useCallback(
    (partial: Partial<AiReviewFormValues>) => {
      onChange({ ...values, ...partial });
    },
    [onChange, values]
  );

  const loadLocations = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const res = await businessApi.locations.list();
      const list = res.data?.business_locations ?? [];
      setLocations(list);
      if (!values.locationId) {
        const preferred =
          (initialLocationId &&
            list.find((l) => l.id === initialLocationId)?.id) ||
          list[0]?.id ||
          '';
        if (preferred) patch({ locationId: preferred });
      }
    } catch {
      setLocations([]);
    } finally {
      setLoadingLoc(false);
    }
  }, [initialLocationId, patch, values.locationId]);

  useFocusEffect(
    useCallback(() => {
      void loadLocations();
    }, [loadLocations])
  );

  const selected = locations.find((l) => l.id === values.locationId);
  const priceNum = Number.parseFloat(values.price);
  const canPublish =
    !busy &&
    !loadingLoc &&
    !!values.locationId &&
    !!values.name.trim() &&
    !Number.isNaN(priceNum) &&
    priceNum > 0;

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
    >
      <Text variant="titleMedium" style={{ color: colors.text.primary }}>
        {t(
          'business.onboarding.firstSale.publish.title',
          'Stock & location'
        )}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginTop: spacing.xs }}
      >
        {t(
          'business.onboarding.firstSale.publish.body',
          'Choose where this product is sold and how many you have in stock.'
        )}
      </Text>

      <View style={[styles.stockBlock, { marginTop: spacing.lg }]}>
        <Text
          variant="titleSmall"
          style={{ color: colors.text.primary, textAlign: 'center' }}
        >
          {t('business.onboarding.firstSale.location.stock', 'Stock')}
        </Text>
        <View style={[styles.qtyRow, { marginTop: spacing.sm }]}>
          <IconButton
            icon="minus"
            mode="contained-tonal"
            onPress={() => {
              const n = Math.max(
                0,
                (Number.parseInt(values.quantity, 10) || 0) - 1
              );
              patch({ quantity: String(n) });
            }}
          />
          <TextInput
            mode="outlined"
            value={values.quantity}
            onChangeText={(quantity) => patch({ quantity })}
            keyboardType="number-pad"
            style={{
              width: 72,
              textAlign: 'center',
              backgroundColor: colors.surface,
            }}
          />
          <IconButton
            icon="plus"
            mode="contained-tonal"
            onPress={() => {
              const n = Math.max(
                0,
                (Number.parseInt(values.quantity, 10) || 0) + 1
              );
              patch({ quantity: String(n) });
            }}
          />
        </View>
      </View>

      <Text
        variant="titleSmall"
        style={{ color: colors.text.primary, marginTop: spacing.md }}
      >
        {t('business.onboarding.firstSale.location.pickLocation', 'Location')}
      </Text>
      <Menu
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchor={
          <Button
            mode="outlined"
            icon="map-marker"
            loading={loadingLoc}
            onPress={() => setMenuOpen(true)}
            style={{ marginTop: spacing.sm }}
            contentStyle={styles.locationBtnContent}
            labelStyle={styles.locationBtnLabel}
          >
            {selected?.name ||
              t(
                'business.onboarding.firstSale.location.pickLocation',
                'Location'
              )}
          </Button>
        }
      >
        {locations.map((loc) => (
          <Menu.Item
            key={loc.id}
            title={loc.name}
            onPress={() => {
              patch({ locationId: loc.id });
              setMenuOpen(false);
            }}
          />
        ))}
        <Menu.Item
          title={t(
            'business.onboarding.firstSale.location.newLocation',
            'New location'
          )}
          leadingIcon="plus"
          onPress={() => {
            setMenuOpen(false);
            navigation.navigate('BusinessLocationForm', {});
          }}
        />
      </Menu>

      <Button
        mode="contained"
        style={{ marginTop: spacing.lg }}
        loading={busy}
        disabled={!canPublish}
        onPress={onPublish}
      >
        {t(
          'business.onboarding.firstSale.review.publish',
          'Publish product'
        )}
      </Button>
      <Button
        mode="text"
        style={{ marginTop: spacing.xs }}
        disabled={busy}
        onPress={onSaveForLater}
      >
        {t(
          'business.onboarding.firstSale.review.finishLater',
          'Finish later'
        )}
      </Button>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  stockBlock: { alignItems: 'center', width: '100%' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  locationBtnContent: { justifyContent: 'flex-start', minHeight: 44 },
  locationBtnLabel: { flexShrink: 1 },
});
