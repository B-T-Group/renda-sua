import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  FAB,
  IconButton,
  SegmentedButtons,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CountryCode } from 'libphonenumber-js';
import { useTheme } from '../../contexts/ThemeContext';
import { useRecipients } from '../../hooks/useRecipients';
import { agentApi } from '../../services/agentApi';
import { AppModal } from '../../components/common/AppModal';
import { RecipientDetailsBlock } from '../../components/checkout/RecipientDetailsBlock';
import type { SavedRecipient } from '../../types/recipient';
import type { RecipientContact } from '../../types/clientOrder';
import {
  isRecipientCountryCode,
  type RecipientCountryCode,
} from '../../utils/recipientsApi';

export default function ManageRecipientsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows } = useTheme();
  const [countryFilter, setCountryFilter] = useState<string>('');
  const { recipients, loading, error, refetch } = useRecipients({
    country: countryFilter || undefined,
  });

  const [editingRecipient, setEditingRecipient] = useState<SavedRecipient | null>(null);
  const [formCountry, setFormCountry] = useState<RecipientCountryCode>('GA');
  const [recipientForm, setRecipientForm] = useState<Partial<RecipientContact>>({
    name: '',
    phone: '',
    notify_whatsapp: false,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleAddNew = useCallback(() => {
    setEditingRecipient(null);
    setFormCountry(isRecipientCountryCode(countryFilter) ? countryFilter : 'GA');
    setRecipientForm({ name: '', phone: '', notify_whatsapp: false });
    setSaveError(null);
    setModalVisible(true);
  }, [countryFilter]);

  const handleEdit = useCallback((recipient: SavedRecipient) => {
    setEditingRecipient(recipient);
    setFormCountry(isRecipientCountryCode(recipient.country) ? recipient.country : 'GA');
    setRecipientForm({
      name: recipient.name,
      phone: recipient.phone,
      notify_whatsapp: recipient.notify_whatsapp,
    });
    setSaveError(null);
    setModalVisible(true);
  }, []);

  const persistRecipient = useCallback(
    async (name: string, phone: string): Promise<boolean> => {
      if (editingRecipient) {
        const res = await agentApi.recipients.update(editingRecipient.id, {
          name,
          phone,
          notify_whatsapp: recipientForm.notify_whatsapp ?? false,
        });
        if (res.success) return true;
        setSaveError(res.error || t('diaspora.saveRecipientFailed', 'Failed to save recipient'));
        return false;
      }
      const res = await agentApi.recipients.create({
        name,
        phone,
        country: formCountry,
        notify_whatsapp: recipientForm.notify_whatsapp ?? false,
      });
      if (res.success) return true;
      setSaveError(res.error || t('diaspora.saveRecipientFailed', 'Failed to save recipient'));
      return false;
    },
    [editingRecipient, recipientForm.notify_whatsapp, formCountry, t]
  );

  const handleSave = useCallback(async () => {
    const name = recipientForm.name?.trim() ?? '';
    const phone = recipientForm.phone?.trim() ?? '';
    if (!name || !phone) {
      setSaveError(t('diaspora.recipientRequired', 'Recipient name and phone are required'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (!(await persistRecipient(name, phone))) return;
      await refetch();
      setModalVisible(false);
    } catch (e: unknown) {
      setSaveError(
        e instanceof Error ? e.message : t('diaspora.saveRecipientFailed', 'Failed to save recipient')
      );
    } finally {
      setSaving(false);
    }
  }, [recipientForm, persistRecipient, refetch, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeleting(id);
      try {
        await agentApi.recipients.delete(id);
        await refetch();
      } catch {
        // Refetch after a failed delete so the list stays in sync.
      } finally {
        setDeleting(null);
      }
    },
    [refetch]
  );

  const renderRecipient = useCallback(
    ({ item }: { item: SavedRecipient }) => (
      <View
        style={[
          styles.recipientCard,
          shadows.sm,
          {
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
            marginBottom: spacing.sm,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="titleMedium" style={{ color: colors.text.primary }}>
            {item.name}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: spacing.xs }}>
            {item.phone}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: spacing.xs }}>
            {item.country}
            {item.notify_whatsapp
              ? ` • ${t('diaspora.whatsAppEnabled', 'WhatsApp enabled')}`
              : ''}
          </Text>
        </View>
        <View style={styles.actions}>
          <IconButton
            icon="pencil"
            size={20}
            onPress={() => handleEdit(item)}
            disabled={!!deleting}
          />
          <IconButton
            icon="delete"
            size={20}
            iconColor={colors.error.main}
            onPress={() => handleDelete(item.id)}
            disabled={deleting === item.id}
          />
        </View>
      </View>
    ),
    [colors, borderRadius, spacing, shadows, deleting, handleEdit, handleDelete, t]
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      edges={['bottom']}
    >
      <View style={{ padding: spacing.md, gap: spacing.md, flex: 1 }}>
        <SegmentedButtons
          value={countryFilter || 'all'}
          onValueChange={(value) => setCountryFilter(value === 'all' ? '' : value)}
          buttons={[
            { value: 'all', label: t('diaspora.allCountries', 'All') },
            { value: 'GA', label: t('diaspora.countryGA', 'Gabon') },
            { value: 'CM', label: t('diaspora.countryCM', 'Cameroon') },
          ]}
        />

        {loading && !recipients.length ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text variant="bodyMedium" style={{ color: colors.error.main, textAlign: 'center' }}>
              {error}
            </Text>
            <Button mode="text" onPress={() => void refetch()} style={{ marginTop: spacing.sm }}>
              {t('common.retry', 'Retry')}
            </Button>
          </View>
        ) : recipients.length === 0 ? (
          <View style={styles.centered}>
            <Text variant="bodyLarge" style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {countryFilter
                ? t('diaspora.noRecipientsForCountry', 'No recipients for {{country}}', {
                    country:
                      countryFilter === 'GA'
                        ? t('diaspora.countryGA', 'Gabon')
                        : t('diaspora.countryCM', 'Cameroon'),
                  })
                : t('diaspora.noRecipients', 'No saved recipients yet')}
            </Text>
            <Button mode="contained" onPress={handleAddNew} style={{ marginTop: spacing.md }}>
              {t('diaspora.addRecipient', 'Add recipient')}
            </Button>
          </View>
        ) : (
          <FlatList
            data={recipients}
            keyExtractor={(item) => item.id}
            renderItem={renderRecipient}
            contentContainerStyle={{ paddingBottom: 80 }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </View>

      <FAB
        icon="plus"
        accessibilityLabel={t('diaspora.addRecipient', 'Add recipient')}
        style={[
          styles.fab,
          { backgroundColor: colors.primary.main, bottom: spacing.lg + 16 },
        ]}
        onPress={handleAddNew}
      />

      <AppModal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !saving && setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.lg,
              },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <Text variant="titleLarge" style={{ marginBottom: spacing.md, color: colors.text.primary }}>
              {editingRecipient
                ? t('diaspora.editRecipient', 'Edit recipient')
                : t('diaspora.addRecipient', 'Add recipient')}
            </Text>

            {!editingRecipient ? (
              <View style={{ marginBottom: spacing.md, gap: spacing.xs }}>
                <Text variant="bodyMedium" style={{ color: colors.text.primary }}>
                  {t('diaspora.recipientCountry', 'Country')}
                </Text>
                <SegmentedButtons
                  value={formCountry}
                  onValueChange={(value) => {
                    if (isRecipientCountryCode(value)) setFormCountry(value);
                  }}
                  buttons={[
                    { value: 'GA', label: t('diaspora.countryGA', 'Gabon') },
                    { value: 'CM', label: t('diaspora.countryCM', 'Cameroon') },
                  ]}
                />
              </View>
            ) : null}

            <RecipientDetailsBlock
              recipient={recipientForm}
              onChange={setRecipientForm}
              defaultCountryCode={formCountry as CountryCode}
              disabled={saving}
            />

            {saveError ? (
              <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: spacing.sm }}>
                {saveError}
              </Text>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <Button
                mode="outlined"
                style={{ flex: 1 }}
                onPress={() => !saving && setModalVisible(false)}
                disabled={saving}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                mode="contained"
                style={{ flex: 1 }}
                onPress={() => void handleSave()}
                loading={saving}
                disabled={saving}
              >
                {t('common.save', 'Save')}
              </Button>
            </View>
            </ScrollView>
          </View>
        </View>
      </AppModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    maxHeight: '88%',
  },
});
