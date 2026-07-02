import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PersonaId } from '../../hooks/useOrderMessages';

const PERSONA_COLOR: Record<
  PersonaId,
  'primary' | 'secondary' | 'warning' | 'success' | 'info' | 'error' | 'default'
> = {
  client: 'primary',
  agent: 'warning',
  business: 'success',
};

interface PersonaBadgeProps {
  persona: PersonaId;
  size?: 'small' | 'medium';
}

export const PersonaBadge: React.FC<PersonaBadgeProps> = ({
  persona,
  size = 'small',
}) => {
  const { t } = useTranslation();

  const label: Record<PersonaId, string> = {
    client: t('personas.client', 'Client'),
    agent: t('personas.agent', 'Agent'),
    business: t('personas.business', 'Business'),
  };

  return (
    <Chip
      label={label[persona]}
      color={PERSONA_COLOR[persona]}
      size={size}
      variant="outlined"
      sx={{ height: 18, fontSize: '0.65rem', lineHeight: 1 }}
    />
  );
};

export default PersonaBadge;
