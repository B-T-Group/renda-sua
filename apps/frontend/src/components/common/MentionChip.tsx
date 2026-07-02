import { AlternateEmail } from '@mui/icons-material';
import { Chip } from '@mui/material';
import React from 'react';
import type { PersonaId } from '../../hooks/useOrderMessages';

const PERSONA_COLOR: Record<
  PersonaId,
  'primary' | 'secondary' | 'warning' | 'success'
> = {
  client: 'primary',
  agent: 'warning',
  business: 'success',
};

interface MentionChipProps {
  displayName: string;
  persona: PersonaId;
  onDelete?: () => void;
  size?: 'small' | 'medium';
}

export const MentionChip: React.FC<MentionChipProps> = ({
  displayName,
  persona,
  onDelete,
  size = 'small',
}) => (
  <Chip
    icon={<AlternateEmail sx={{ fontSize: 14 }} />}
    label={`@${displayName}`}
    color={PERSONA_COLOR[persona]}
    size={size}
    onDelete={onDelete}
    variant="filled"
    sx={{ fontWeight: 600, maxWidth: 200 }}
  />
);

export default MentionChip;
