import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  normalizeAgentFocus,
  type AgentFocus,
} from '../../utils/agentFocus';

const OPTIONS: Array<{
  id: AgentFocus;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
}> = [
  {
    id: 'delivery',
    titleKey: 'agent.focus.deliveryTitle',
    titleDefault: 'Delivery',
    bodyKey: 'agent.focus.deliveryBody',
    bodyDefault: 'Pick up and deliver orders to customers.',
  },
  {
    id: 'commercial',
    titleKey: 'agent.focus.commercialTitle',
    titleDefault: 'Recruit businesses',
    bodyKey: 'agent.focus.commercialBody',
    bodyDefault: 'Help local shops join Rendasua and follow them through setup.',
  },
  {
    id: 'both',
    titleKey: 'agent.focus.bothTitle',
    titleDefault: 'Both',
    bodyKey: 'agent.focus.bothBody',
    bodyDefault: 'Deliver orders and recruit businesses.',
  },
];

export const AgentFocusSettings: React.FC<{ onSaved?: () => void }> = ({
  onSaved,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { profile, refetch } = useUserProfileContext();
  const current = normalizeAgentFocus(profile?.agent?.focus);
  const [value, setValue] = useState<AgentFocus>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(current);
  }, [current]);

  const save = useCallback(async () => {
    if (!apiClient) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch('/agents/me/focus', { focus: value });
      await refetch();
      onSaved?.();
    } catch (err: any) {
      setError(err?.message || t('agent.focus.saveError', 'Could not update focus.'));
    } finally {
      setSaving(false);
    }
  }, [apiClient, onSaved, refetch, t, value]);

  if (!profile?.agent?.id) return null;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700}>
          {t('agent.focus.settingsTitle', 'Agent focus')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t(
            'agent.focus.settingsHint',
            'Choose whether you deliver orders, recruit businesses, or both.'
          )}
        </Typography>
        <Stack spacing={1}>
          {OPTIONS.map((opt) => {
            const selected = value === opt.id;
            return (
              <Card
                key={opt.id}
                variant="outlined"
                sx={{
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                }}
              >
                <CardActionArea onClick={() => setValue(opt.id)}>
                  <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t(opt.titleKey, opt.titleDefault)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(opt.bodyKey, opt.bodyDefault)}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
        {error ? (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          sx={{ mt: 1.5 }}
          onClick={() => void save()}
          disabled={saving || value === current}
        >
          {t('agent.focus.save', 'Save focus')}
        </Button>
      </CardContent>
    </Card>
  );
};
