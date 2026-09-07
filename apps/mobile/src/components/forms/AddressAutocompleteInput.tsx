import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchPlaceDetails,
  fetchPlacePredictions,
} from '../../services/googleMapsApi';
import type { GeocodeApiResult, PlacePrediction } from '../../types/googleMapsApi';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;

export interface AddressAutocompleteInputProps {
  label: string;
  value: string;
  /** ISO2 code used to bias/restrict Google predictions. */
  country?: string;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  /** Fired when the user picks a prediction and details resolve. */
  onSelectPlace: (result: GeocodeApiResult) => void;
  theme?: object;
}

/**
 * Address line input backed by Google Places autocomplete (via the Nest proxy),
 * restricted to `country`. Selecting a prediction resolves place details so the
 * caller can autofill the rest of the address.
 */
export function AddressAutocompleteInput({
  label,
  value,
  country,
  disabled = false,
  onChangeText,
  onSelectPlace,
  theme,
}: AddressAutocompleteInputProps) {
  const { t } = useTranslation();
  const { colors, borderRadius } = useTheme();
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  // Suppress the next predictions fetch right after a selection.
  const skipNextRef = useRef(false);

  useEffect(() => {
    if (disabled) return;
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = setTimeout(() => {
      void fetchPlacePredictions(query, country)
        .then((rows) => {
          if (!active) return;
          setPredictions(rows);
          setOpen(rows.length > 0);
        })
        .catch(() => {
          if (active) setPredictions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [value, country, disabled]);

  const handleSelect = useCallback(
    async (prediction: PlacePrediction) => {
      skipNextRef.current = true;
      setOpen(false);
      setPredictions([]);
      setResolving(true);
      try {
        const details = await fetchPlaceDetails(prediction.place_id);
        if (details) {
          onSelectPlace(details);
        } else {
          onChangeText(prediction.description);
        }
      } catch {
        onChangeText(prediction.description);
      } finally {
        setResolving(false);
      }
    },
    [onChangeText, onSelectPlace]
  );

  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        disabled={disabled}
        theme={theme}
        autoCorrect={false}
        right={
          loading || resolving ? (
            <TextInput.Icon icon={() => <ActivityIndicator size={18} color={colors.primary.main} />} />
          ) : undefined
        }
      />
      {open && predictions.length > 0 ? (
        <View
          style={[
            styles.dropdown,
            { backgroundColor: colors.surface, borderColor: colors.divider, borderRadius: borderRadius.sm },
          ]}
        >
          {predictions.map((p, idx) => (
            <Pressable
              key={p.place_id}
              onPress={() => void handleSelect(p)}
              style={({ pressed }) => [
                styles.row,
                {
                  borderBottomColor: colors.divider,
                  borderBottomWidth: idx === predictions.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  backgroundColor: pressed ? colors.pageBackground : 'transparent',
                },
              ]}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.text.secondary} />
              <Text variant="bodyMedium" style={[styles.rowText, { color: colors.text.primary }]} numberOfLines={2}>
                {p.description}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {open && !loading && predictions.length === 0 && value.trim().length >= MIN_QUERY_LENGTH ? (
        <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
          {t('addresses.autocompleteEmpty', 'No address suggestions found.')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  dropdown: {
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
});
