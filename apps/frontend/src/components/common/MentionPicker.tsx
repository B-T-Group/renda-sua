import { AlternateEmail } from '@mui/icons-material';
import {
  Avatar,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MentionableParticipant } from '../../hooks/useOrderMessages';
import { PersonaBadge } from './PersonaBadge';

interface MentionPickerProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  participants: MentionableParticipant[];
  loading: boolean;
  query: string;
  onSelect: (participant: MentionableParticipant) => void;
  onClose: () => void;
}

export const MentionPicker: React.FC<MentionPickerProps> = ({
  anchorEl,
  open,
  participants,
  loading,
  query,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();

  const filtered = participants.filter((p) =>
    p.displayName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Popper
      open={open && !!anchorEl}
      anchorEl={anchorEl}
      placement="top-start"
      style={{ zIndex: 1500 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
    >
      <Paper
        elevation={4}
        sx={{ minWidth: 240, maxWidth: 360, maxHeight: 240, overflow: 'auto' }}
        onMouseDown={(e) => e.preventDefault()}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {t('messages.mentionNoResults', 'No one to mention yet')}
            </Typography>
          </Box>
        ) : (
          <List dense disablePadding>
            {filtered.map((participant) => (
              <ListItem key={participant.userId} disablePadding>
                <ListItemButton
                  onClick={() => {
                    onSelect(participant);
                    onClose();
                  }}
                  aria-label={t(
                    'messages.mentionAriaLabel',
                    'Mention {{name}}, {{persona}}',
                    {
                      name: participant.displayName,
                      persona: participant.persona,
                    }
                  )}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                      <AlternateEmail sx={{ fontSize: 14 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={participant.displayName}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  />
                  <PersonaBadge persona={participant.persona} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Popper>
  );
};

export default MentionPicker;
