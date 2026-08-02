import { Email, Person, Phone } from '@mui/icons-material';
import {
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ContactInfo {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  subtitle?: string | null;
}

export interface ContactCardProps {
  title: string;
  contact?: ContactInfo | null;
  emptyLabel?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  title,
  contact,
  emptyLabel,
}) => {
  const { t } = useTranslation();

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {!contact?.name && !contact?.phone && !contact?.email ? (
            <Typography variant="body2" color="text.secondary">
              {emptyLabel ??
                t('orders.contact.unavailable', 'Contact unavailable')}
            </Typography>
          ) : (
            <>
              {contact.name ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Person fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>
                    {contact.name}
                  </Typography>
                </Stack>
              ) : null}
              {contact.subtitle ? (
                <Typography variant="caption" color="text.secondary">
                  {contact.subtitle}
                </Typography>
              ) : null}
              {contact.phone ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Phone fontSize="small" color="action" />
                  <Link href={`tel:${contact.phone}`} variant="body2">
                    {contact.phone}
                  </Link>
                </Stack>
              ) : null}
              {contact.email ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Email fontSize="small" color="action" />
                  <Link href={`mailto:${contact.email}`} variant="body2">
                    {contact.email}
                  </Link>
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ContactCard;
