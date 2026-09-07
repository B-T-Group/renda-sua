import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';
import { AgentFocusStep } from '@/components/signup/steps/AgentFocusStep';
import { useAgentFocus } from '@/hooks/useAgentFocus';
import { agentApi } from '@/services/agentApi';
import { AGENT_FOCUS_VALUES, type AgentFocus } from '@/types/agentFocus';

interface Props {
  onSaved?: () => void;
}

function isAgentFocus(value: string): value is AgentFocus {
  return (AGENT_FOCUS_VALUES as readonly string[]).includes(value);
}

export function AgentFocusSettings({ onSaved }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { focus, loading, refetch } = useAgentFocus(true);
  const [value, setValue] = useState<AgentFocus | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (focus) setValue(focus);
  }, [focus]);

  const selected = isAgentFocus(value) ? value : focus ?? '';
  const dirty = isAgentFocus(value) && value !== focus;

  const save = useCallback(async () => {
    if (!isAgentFocus(value)) return;
    setSaving(true);
    setError(null);
    try {
      await agentApi.agents.updateFocus(value);
      await refetch();
      onSaved?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('agent.focus.saveError', 'Could not update focus.')
      );
    } finally {
      setSaving(false);
    }
  }, [onSaved, refetch, t, value]);

  if (loading || !focus) return null;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="titleMedium" style={{ color: colors.text.primary, fontWeight: '700' }}>
        {t('agent.focus.settingsTitle', 'Agent focus')}
      </Text>
      <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
        {t(
          'agent.focus.settingsHint',
          'Choose whether you deliver orders, recruit businesses, or both.'
        )}
      </Text>
      <AgentFocusStep value={selected} disabled={saving} onChange={setValue} />
      {error ? (
        <Text variant="bodySmall" style={{ color: colors.error.main }}>
          {error}
        </Text>
      ) : null}
      <Button
        mode="contained"
        onPress={() => void save()}
        loading={saving}
        disabled={saving || !dirty}
      >
        {t('agent.focus.save', 'Save focus')}
      </Button>
    </View>
  );
}
