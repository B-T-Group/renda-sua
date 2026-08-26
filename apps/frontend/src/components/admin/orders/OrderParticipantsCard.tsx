import EmailIcon from '@mui/icons-material/Email';
import MessageIcon from '@mui/icons-material/Message';
import PhoneIcon from '@mui/icons-material/Phone';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AdminOrderContact,
  OrderContactRole,
} from '../../../hooks/useAdminOrders';

interface OrderParticipantsCardProps {
  contacts: AdminOrderContact[];
  onMessage: (role: OrderContactRole) => void;
}

export const OrderParticipantsCard: React.FC<OrderParticipantsCardProps> = ({
  contacts,
  onMessage,
}) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.participants', 'People on this order')}
        </Typography>
        {contacts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.orders.noContacts',
              'No contact details are available for this order yet.'
            )}
          </Typography>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={1.5}>
            {contacts.map((contact) => (
              <ContactRow
                key={contact.role}
                contact={contact}
                onMessage={onMessage}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

const ContactRow: React.FC<{
  contact: AdminOrderContact;
  onMessage: (role: OrderContactRole) => void;
}> = ({ contact, onMessage }) => {
  const { t } = useTranslation();
  const roleLabels: Record<OrderContactRole, string> = {
    client: t('admin.orders.client', 'Client'),
    business: t('admin.orders.business', 'Business'),
    agent: t('admin.orders.agent', 'Agent'),
  };

  return (
    <Box sx={{ pt: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {roleLabels[contact.role]}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {contact.name || t('admin.orders.unnamedContact', 'Name unavailable')}
      </Typography>
      <Stack spacing={0.25} sx={{ mt: 0.5 }}>
        {contact.email && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <EmailIcon fontSize="inherit" /> {contact.email}
          </Typography>
        )}
        {contact.phone && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <PhoneIcon fontSize="inherit" /> {contact.phone}
          </Typography>
        )}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
        <Button
          size="small"
          startIcon={<MessageIcon />}
          disabled={!contact.can_message}
          onClick={() => onMessage(contact.role)}
        >
          {t('admin.orders.message', 'Message')}
        </Button>
        {contact.phone && (
          <Button size="small" href={`tel:${contact.phone}`}>
            {t('admin.orders.call', 'Call')}
          </Button>
        )}
      </Stack>
      {!contact.can_message && (
        <Typography variant="caption" color="text.secondary">
          {t(
            'admin.orders.messageUnavailable',
            'In-app messaging needs a linked account.'
          )}
        </Typography>
      )}
    </Box>
  );
};
