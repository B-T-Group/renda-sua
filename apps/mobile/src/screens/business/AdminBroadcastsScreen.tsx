import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { usePermission } from '../../hooks/usePermissions';
import { useProfileMe } from '../../hooks/useProfileMe';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { StatusPill } from '../../components/common/StatusPill';
import { adminBroadcastsApi } from '../../services/adminBroadcastsApi';
import type {
  BroadcastAudienceType,
  BroadcastCampaign,
  BroadcastFilters,
  BroadcastTemplateKey,
  BroadcastUserOption,
} from '../../types/adminBroadcast';

const APP_UPGRADE_BODY =
  'A new version of Rendasua is available. Update the app to get the latest features, fixes, and improvements.';
const ACCOUNT_SETUP_BODY =
  'Your merchant contract is signed. Complete your payment account setup so you can start accepting orders on Rendasua.';

export default function AdminBroadcastsScreen() {
  const { t, i18n } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, loading: profileLoading } = useProfileMe();
  const canAccess = usePermission(PlatformPermissions.OPS_USER_MESSAGES, me);

  const [audienceType, setAudienceType] =
    useState<BroadcastAudienceType>('everyone');
  const [templateKey, setTemplateKey] =
    useState<BroadcastTemplateKey>('app_upgrade');
  const [title, setTitle] = useState(
    t('admin.broadcasts.templates.appUpgradeTitle', 'Update Rendasua')
  );
  const [body, setBody] = useState(APP_UPGRADE_BODY);
  const [lifecycle, setLifecycle] = useState('');
  const [countries, setCountries] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<BroadcastUserOption[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<BroadcastUserOption[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<BroadcastCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  const filters: BroadcastFilters = useMemo(() => {
    const f: BroadcastFilters = {};
    if (audienceType === 'user') {
      f.userIds = selectedUsers.map((u) => u.id);
      f.emails = selectedUsers.map((u) => u.email);
      return f;
    }
    if (audienceType === 'business' && lifecycle.trim()) {
      f.lifecycleStatuses = lifecycle
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (audienceType === 'agent' && isAvailable) f.isAvailable = true;
    const codes = countries
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length) f.countries = codes;
    return f;
  }, [audienceType, lifecycle, countries, isAvailable, selectedUsers]);

  const refreshPreview = useCallback(async () => {
    try {
      const result = await adminBroadcastsApi.preview({
        audienceType,
        filters,
        templateKey,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setPreviewText(
        t('admin.broadcasts.previewSummary', {
          defaultValue:
            '{{total}} users · {{eligible}} eligible · {{skip}} skipped (7d)',
          total: result.total,
          eligible: result.eligible,
          skip: result.wouldSkipDedupe,
        })
      );
    } catch {
      setPreviewText('');
    }
  }, [audienceType, filters, t, templateKey, title, body]);

  const refreshHistory = useCallback(async () => {
    try {
      const result = await adminBroadcastsApi.list(1, 20);
      setItems(result.items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void refreshPreview(), 350);
    return () => clearTimeout(timer);
  }, [refreshPreview]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    if (audienceType !== 'user') return;
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      setUserSearchLoading(true);
      void adminBroadcastsApi
        .searchUsers(q)
        .then(setUserOptions)
        .finally(() => setUserSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [audienceType, userQuery]);

  const onAudienceChange = (value: string) => {
    const next = value as BroadcastAudienceType;
    setAudienceType(next);
    if (next === 'everyone') {
      applyTemplate('app_upgrade');
    } else if (next === 'business') {
      applyTemplate('business_account_setup');
      if (!lifecycle.trim()) setLifecycle('contract_signed');
    } else {
      applyTemplate('custom');
    }
    if (next !== 'user') {
      setSelectedUsers([]);
      setUserQuery('');
      setUserOptions([]);
    }
  };

  const selectUser = (user: BroadcastUserOption) => {
    setSelectedUsers((prev) =>
      prev.some((p) => p.id === user.id) ? prev : [...prev, user]
    );
    setUserQuery('');
    setUserOptions([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const applyTemplate = (key: BroadcastTemplateKey) => {
    setTemplateKey(key);
    if (key === 'app_upgrade') {
      setTitle(t('admin.broadcasts.templates.appUpgradeTitle', 'Update Rendasua'));
      setBody(APP_UPGRADE_BODY);
      return;
    }
    if (key === 'business_account_setup') {
      setTitle(
        t('admin.broadcasts.templates.accountSetupTitle', 'Finish payment setup')
      );
      setBody(ACCOUNT_SETUP_BODY);
      return;
    }
    setTitle('');
    setBody('');
  };

  const onSend = async () => {
    if (!body.trim() || sending) return;
    if (audienceType === 'user' && selectedUsers.length === 0) {
      setError(
        t(
          'admin.broadcasts.selectUserRequired',
          'Select at least one user by email before sending.'
        )
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      await adminBroadcastsApi.create({
        audienceType,
        filters,
        templateKey,
        title: title.trim() || undefined,
        body: body.trim(),
        sourceLanguage: i18n.language?.startsWith('fr') ? 'fr' : 'en',
      });
      await refreshHistory();
      await refreshPreview();
    } catch (e: any) {
      setError(e?.message ?? t('admin.broadcasts.sendError', 'Failed to send'));
    } finally {
      setSending(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text>{t('common.loading', 'Loading...')}</Text>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <Text style={{ color: colors.error.main }}>
          {t(
            'admin.broadcasts.unauthorized',
            'You do not have permission to send admin broadcasts.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      contentContainerStyle={{
        padding: spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        gap: spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[typography.h6, { color: colors.text.primary }]}>
        {t('admin.broadcasts.title', 'Global messaging')}
      </Text>
      <Text style={[typography.body2, { color: colors.text.secondary }]}>
        {t(
          'admin.broadcasts.subtitle',
          'Target users by persona and filters, preview the audience, then send a bilingual push notification.'
        )}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <SegmentedButtons
          value={audienceType}
          onValueChange={onAudienceChange}
          style={{ minWidth: 520 }}
          buttons={[
            {
              value: 'everyone',
              label: t('admin.broadcasts.audienceTypes.everyone', 'All'),
            },
            {
              value: 'business',
              label: t('admin.broadcasts.audienceTypes.business', 'Biz'),
            },
            {
              value: 'agent',
              label: t('admin.broadcasts.audienceTypes.agent', 'Agent'),
            },
            {
              value: 'client',
              label: t('admin.broadcasts.audienceTypes.client', 'Client'),
            },
            {
              value: 'user',
              label: t('admin.broadcasts.audienceTypes.user', 'User'),
            },
          ]}
        />
      </ScrollView>

      {audienceType === 'user' ? (
        <View style={{ gap: 8 }}>
          <TextInput
            mode="outlined"
            label={t('admin.broadcasts.searchUserEmail', 'Search user by email')}
            value={userQuery}
            onChangeText={setUserQuery}
            autoCapitalize="none"
            keyboardType="email-address"
            right={
              userSearchLoading ? (
                <TextInput.Affix text={t('common.loading', 'Loading...')} />
              ) : undefined
            }
          />
          {selectedUsers.map((user) => (
            <Pressable key={user.id} onPress={() => removeUser(user.id)}>
              <StatusPill
                compact
                label={user.email}
                backgroundColor={`${colors.primary.main}22`}
                textColor={colors.primary.main}
              />
            </Pressable>
          ))}
          {userOptions.map((user) => (
            <Pressable
              key={user.id}
              onPress={() => selectUser(user)}
              style={[
                styles.card,
                {
                  borderColor: colors.divider,
                  backgroundColor: colors.surface,
                  borderRadius: borderRadius.md,
                  padding: spacing.sm,
                },
              ]}
            >
              <Text style={[typography.body2, { color: colors.text.primary }]}>
                {user.email}
              </Text>
              {user.firstName || user.lastName ? (
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                >
                  {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {audienceType === 'business' ? (
        <TextInput
          mode="outlined"
          label={t('admin.broadcasts.lifecycleStatus', 'Lifecycle (comma-separated)')}
          value={lifecycle}
          onChangeText={setLifecycle}
        />
      ) : null}

      {audienceType === 'agent' ? (
        <Button
          mode={isAvailable ? 'contained' : 'outlined'}
          onPress={() => setIsAvailable((v) => !v)}
        >
          {t('admin.broadcasts.availableAgentsOnly', 'Available agents only')}
        </Button>
      ) : null}

      {audienceType !== 'user' ? (
        <TextInput
          mode="outlined"
          label={t('admin.broadcasts.countries', 'Countries (e.g. CM, GA)')}
          value={countries}
          onChangeText={setCountries}
        />
      ) : null}

      <SegmentedButtons
        value={templateKey}
        onValueChange={(v) => applyTemplate(v as BroadcastTemplateKey)}
        buttons={[
          { value: 'custom', label: t('admin.broadcasts.templates.custom', 'Custom') },
          {
            value: 'app_upgrade',
            label: t('admin.broadcasts.templates.appUpgrade', 'Upgrade'),
          },
          {
            value: 'business_account_setup',
            label: t('admin.broadcasts.templates.accountSetup', 'Setup'),
          },
        ]}
      />

      <TextInput
        mode="outlined"
        label={t('admin.broadcasts.messageTitle', 'Title')}
        value={title}
        onChangeText={setTitle}
      />
      <TextInput
        mode="outlined"
        multiline
        numberOfLines={4}
        label={t('admin.broadcasts.messageBody', 'Message')}
        value={body}
        onChangeText={setBody}
        style={{ minHeight: 100 }}
      />

      <View
        style={[
          styles.card,
          shadows.sm,
          {
            borderColor: colors.divider,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={[typography.subtitle2, { color: colors.text.primary }]}>
          {t('admin.broadcasts.audiencePreview', 'Audience preview')}
        </Text>
        <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
          {previewText || t('common.loading', 'Loading...')}
        </Text>
        <Button
          mode="contained"
          loading={sending}
          disabled={
            !body.trim() ||
            sending ||
            (audienceType === 'user' && selectedUsers.length === 0)
          }
          onPress={() => void onSend()}
          style={{ marginTop: spacing.md }}
        >
          {t('admin.broadcasts.send', 'Send broadcast')}
        </Button>
        {error ? (
          <Text style={{ color: colors.error.main, marginTop: spacing.sm }}>{error}</Text>
        ) : null}
      </View>

      <Text style={[typography.subtitle1, { color: colors.text.primary }]}>
        {t('admin.broadcasts.history', 'Campaign history')}
      </Text>
      {items.length === 0 ? (
        <Text style={{ color: colors.text.secondary }}>
          {t('admin.broadcasts.emptyHistory', 'No broadcasts sent yet')}
        </Text>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
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
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <StatusPill
                compact
                label={item.status}
                backgroundColor={`${colors.primary.main}22`}
                textColor={colors.primary.main}
              />
              <StatusPill
                compact
                label={
                  item.audience_type === 'user' && item.filters?.emails?.length
                    ? item.filters.emails.join(', ')
                    : item.audience_type
                }
                backgroundColor={`${colors.text.secondary}18`}
                textColor={colors.text.secondary}
              />
            </View>
            <Text
              style={[typography.subtitle2, { color: colors.text.primary, marginTop: 8 }]}
              numberOfLines={1}
            >
              {item.title_en || item.source_body}
            </Text>
            <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 4 }]}>
              {item.sent_count}/{item.skipped_dedupe_count}/{item.failed_count} ·{' '}
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderWidth: 1,
  },
});
