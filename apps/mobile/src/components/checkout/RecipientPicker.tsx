import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ActivityIndicator, Button, RadioButton, Text } from 'react-native-paper';
import type { CountryCode } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { RecipientDetailsBlock } from './RecipientDetailsBlock';
import { useRecipients } from '../../hooks/useRecipients';
import { agentApi } from '../../services/agentApi';
import type { RecipientContact } from '../../types/clientOrder';

export interface RecipientPickerProps {
  /** Current recipient data (name, phone, notify_whatsapp). */
  recipient: Partial<RecipientContact>;
  /** Callback when recipient data changes. */
  onChange: (value: Partial<RecipientContact>) => void;
  /** ISO country code for filtering saved recipients and phone input. */
  country?: string;
  /** Default country code for phone input (derived from fulfillment country). */
  defaultCountryCode?: CountryCode;
  /** Disable all inputs (e.g. during submission). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Recipient picker for diaspora orders.
 * Allows selecting from a list of saved recipients OR adding a new one.
 */
export function RecipientPicker({
  recipient,
  onChange,
  country,
  defaultCountryCode,
  disabled,
  style,
}: RecipientPickerProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing, shadows } = useTheme();
  const { recipients, loading, error, refetch } = useRecipients({
    country,
    enabled: Boolean(country),
  });

  const [mode, setMode] = useState<'select' | 'new'>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const prevCountryRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (prevCountryRef.current !== undefined && prevCountryRef.current !== country) {
      setSelectedId(null);
      setMode('select');
      setSaveError(null);
      onChange({ name: '', phone: '', notify_whatsapp: false });
    }
    prevCountryRef.current = country;
  }, [country, onChange]);

  // Sync onChange when selecting a saved recipient
  const handleSelectRecipient = useCallback(
    (id: string) => {
      setSelectedId(id);
      const found = recipients.find((r) => r.id === id);
      if (found) {
        onChange({
          name: found.name,
          phone: found.phone,
          notify_whatsapp: found.notify_whatsapp,
        });
      }
    },
    [recipients, onChange]
  );

  const handleSaveNew = useCallback(async () => {
    if (!recipient.name?.trim() || !recipient.phone?.trim() || !country) {
      setSaveError(t('diaspora.recipientRequired', 'Recipient name and phone are required'));
      return;
    }
    setSavingNew(true);
    setSaveError(null);
    try {
      const res = await agentApi.recipients.create({
        name: recipient.name.trim(),
        phone: recipient.phone.trim(),
        country,
        notify_whatsapp: recipient.notify_whatsapp ?? false,
      });
      if (res.success && res.recipient) {
        onChange({
          name: res.recipient.name,
          phone: res.recipient.phone,
          notify_whatsapp: res.recipient.notify_whatsapp,
        });
        await refetch();
        setMode('select');
        setSelectedId(res.recipient.id);
      } else {
        setSaveError(res.error || t('diaspora.saveRecipientFailed', 'Failed to save recipient'));
      }
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : t('diaspora.saveRecipientFailed', 'Failed to save recipient'));
    } finally {
      setSavingNew(false);
    }
  }, [recipient, country, refetch, t, onChange]);

  const handleModeChange = useCallback(
    (newMode: 'select' | 'new') => {
      setMode(newMode);
      setSaveError(null);
      setSelectedId(null);
      onChange({ name: '', phone: '', notify_whatsapp: false });
    },
    [onChange]
  );

  if (loading && !recipients.length) {
    return (
      <View
        style={[
          styles.container,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            borderColor: colors.divider,
            padding: spacing.md,
          },
          style,
        ]}
      >
        <Text variant="titleSmall" style={{ color: colors.text.primary, marginBottom: spacing.sm }}>
          {t('diaspora.selectRecipientTitle', 'Who is receiving this order?')}
        </Text>
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary.main} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.md,
          borderColor: colors.divider,
          padding: spacing.md,
          gap: spacing.md,
        },
        style,
      ]}
    >
      <Text variant="titleSmall" style={{ color: colors.text.primary }}>
        {t('diaspora.selectRecipientTitle', 'Who is receiving this order?')}
      </Text>

      {error && !recipients.length ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {error}
        </Text>
      ) : null}

      {/* Mode toggle: select from list OR add new */}
      {recipients.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <View style={styles.modeRow}>
            <RadioButton
              value="select"
              status={mode === 'select' ? 'checked' : 'unchecked'}
              onPress={() => handleModeChange('select')}
              disabled={disabled}
            />
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.primary, flex: 1 }}
              onPress={() => !disabled && handleModeChange('select')}
            >
              {t('diaspora.selectSavedRecipient', 'Select saved recipient')}
            </Text>
          </View>
          <View style={styles.modeRow}>
            <RadioButton
              value="new"
              status={mode === 'new' ? 'checked' : 'unchecked'}
              onPress={() => handleModeChange('new')}
              disabled={disabled}
            />
            <Text
              variant="bodyMedium"
              style={{ color: colors.text.primary, flex: 1 }}
              onPress={() => !disabled && handleModeChange('new')}
            >
              {t('diaspora.addNewRecipient', 'Add new recipient')}
            </Text>
          </View>
        </View>
      ) : null}

      {mode === 'select' && recipients.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {!selectedId ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
              {t('diaspora.selectRecipientPrompt', 'Tap a recipient to continue')}
            </Text>
          ) : null}
          {recipients.map((r) => (
            <Pressable
              key={r.id}
              style={styles.recipientCard}
              onPress={() => !disabled && handleSelectRecipient(r.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selectedId === r.id, disabled: !!disabled }}
            >
              <RadioButton
                value={r.id}
                status={selectedId === r.id ? 'checked' : 'unchecked'}
                onPress={() => !disabled && handleSelectRecipient(r.id)}
                disabled={disabled}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
                  {r.name}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                  {r.phone}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {mode === 'new' || recipients.length === 0 ? (
        <View style={{ gap: spacing.sm }}>
          <RecipientDetailsBlock
            recipient={recipient}
            onChange={onChange}
            defaultCountryCode={defaultCountryCode}
            disabled={disabled || savingNew}
          />
          {/* Always show Save button in new mode, including empty-list path */}
          <Button
            mode="contained-tonal"
            onPress={handleSaveNew}
            loading={savingNew}
            disabled={disabled || savingNew}
            icon="content-save-outline"
          >
            {t('diaspora.saveRecipient', 'Save recipient')}
          </Button>
          {saveError ? (
            <Text variant="bodySmall" style={{ color: colors.error.main }}>
              {saveError}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
