import {
  Alert,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CountryDeliveryConfigRow,
  DeliveryPricingInput,
} from '../../hooks/useApplicationSetup';

interface DeliveryPricingCardProps {
  countryCode: string;
  countryConfigs: CountryDeliveryConfigRow[];
  onSave: (pricing: DeliveryPricingInput) => Promise<void>;
}

const FIELDS: Array<{ key: keyof DeliveryPricingInput; labelKey: string; label: string }> = [
  { key: 'normal_delivery_base_fee', labelKey: 'admin.applicationSetup.baseDeliveryPrice', label: 'Base delivery price' },
  { key: 'per_km_delivery_fee', labelKey: 'admin.applicationSetup.perKmPrice', label: 'Per km price' },
  { key: 'max_delivery_fee', labelKey: 'admin.applicationSetup.maxDeliveryPrice', label: 'Maximum delivery price' },
  { key: 'delivery_availability_radius_km', labelKey: 'admin.applicationSetup.agentRadiusKm', label: 'Agent eligibility radius (km)' },
  { key: 'free_delivery_commission_threshold', labelKey: 'admin.applicationSetup.freeDeliveryCommission', label: 'Free-delivery commission amount' },
];

function readNumber(configs: CountryDeliveryConfigRow[], key: string): string {
  const row = configs.find((config) => config.config_key === key);
  return row?.config_value ?? '';
}

function deducedKm(values: Record<keyof DeliveryPricingInput, string>): number | null {
  const maxFee = Number(values.max_delivery_fee);
  const perKm = Number(values.per_km_delivery_fee);
  const base = Number(values.normal_delivery_base_fee);
  if (!(maxFee > 0) || !(perKm > 0)) return null;
  return Math.max(0, (maxFee - base) / perKm);
}

export const DeliveryPricingCard: React.FC<DeliveryPricingCardProps> = ({
  countryCode,
  countryConfigs,
  onSave,
}) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<keyof DeliveryPricingInput, string>>({
    normal_delivery_base_fee: '',
    per_km_delivery_fee: '',
    max_delivery_fee: '',
    delivery_availability_radius_km: '',
    free_delivery_commission_threshold: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      normal_delivery_base_fee: readNumber(countryConfigs, 'normal_delivery_base_fee'),
      per_km_delivery_fee: readNumber(countryConfigs, 'per_km_delivery_fee'),
      max_delivery_fee: readNumber(countryConfigs, 'max_delivery_fee'),
      delivery_availability_radius_km: readNumber(
        countryConfigs,
        'delivery_availability_radius_km'
      ),
      free_delivery_commission_threshold: readNumber(
        countryConfigs,
        'free_delivery_commission_threshold'
      ),
    });
  }, [countryCode, countryConfigs]);

  const clientKm = useMemo(() => deducedKm(values), [values]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await onSave(toPricing(values));
      setMessage(t('admin.applicationSetup.pricingSaved', 'Delivery pricing saved.'));
    } catch (err: any) {
      setError(
        err.message ||
          t('admin.applicationSetup.pricingSaveFailed', 'Could not save delivery pricing.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {t('admin.applicationSetup.deliveryPricingTitle', 'Delivery pricing')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t(
            'admin.applicationSetup.deliveryPricingHelp',
            'These prices apply to the selected country. The client distance is calculated from the base, per km rate, and maximum fee.'
          )}
        </Typography>
        <Stack spacing={2}>
          {FIELDS.map((field) => (
            <TextField
              key={field.key}
              type="number"
              label={t(field.labelKey, field.label)}
              value={values[field.key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.key]: event.target.value }))
              }
              helperText={
                field.key === 'delivery_availability_radius_km'
                  ? t(
                      'admin.applicationSetup.agentRadiusHelp',
                      'An active agent must be within this distance of the store. Agents are notified only inside it.'
                    )
                  : undefined
              }
              inputProps={{ min: 0, step: 'any' }}
            />
          ))}
          <Typography variant="body2">
            {clientKm == null
              ? t(
                  'admin.applicationSetup.deducedClientDistanceUnset',
                  'Covered client distance is not limited by price until a maximum fee and per km rate are set.'
                )
              : t('admin.applicationSetup.deducedClientDistance', 'Covered client distance: {{km}} km', {
                  km: Number(clientKm.toFixed(2)),
                })}
          </Typography>
          {message ? <Alert severity="success">{message}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {t('admin.applicationSetup.savePricing', 'Save pricing')}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

function toPricing(
  values: Record<keyof DeliveryPricingInput, string>
): DeliveryPricingInput {
  return {
    normal_delivery_base_fee: Number(values.normal_delivery_base_fee),
    per_km_delivery_fee: Number(values.per_km_delivery_fee),
    max_delivery_fee: Number(values.max_delivery_fee),
    delivery_availability_radius_km: Number(values.delivery_availability_radius_km),
    free_delivery_commission_threshold: Number(
      values.free_delivery_commission_threshold
    ),
  };
}
