import { ChatBubbleOutline } from '@mui/icons-material';
import { Badge, Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface RentalMessagesButtonProps {
  unreadCount: number;
  onClick: () => void;
}

export const RentalMessagesButton: React.FC<RentalMessagesButtonProps> = ({
  unreadCount,
  onClick,
}) => {
  const { t } = useTranslation();
  const label =
    unreadCount > 0
      ? t('rentals.messages.openWithUnread', 'Messages, {{count}} unread', {
          count: unreadCount,
        })
      : t('rentals.messages.title', 'Messages');

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={onClick}
      aria-label={label}
      startIcon={
        <Badge color="error" badgeContent={unreadCount} max={9}>
          <ChatBubbleOutline fontSize="small" />
        </Badge>
      }
      sx={{ fontWeight: 700, borderRadius: 999 }}
    >
      {t('rentals.messages.title', 'Messages')}
    </Button>
  );
};
