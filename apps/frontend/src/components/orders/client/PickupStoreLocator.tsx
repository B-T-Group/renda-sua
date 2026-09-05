import { Grid } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AddressCard, type AddressFields } from '../shared/AddressCard';
import { ContactCard, type ContactInfo } from '../shared/ContactCard';

export interface PickupStoreLocatorProps {
  address?: AddressFields | null;
  storeName?: string | null;
  contact?: ContactInfo | null;
}

export function PickupStoreLocator({
  address,
  storeName,
  contact,
}: PickupStoreLocatorProps) {
  const { t } = useTranslation();
  const hasAddress = Boolean(
    address?.address_line_1 || address?.city || address?.country
  );
  const hasContact = Boolean(contact?.name || contact?.phone || contact?.email);
  if (!hasAddress && !hasContact) return null;

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {hasAddress ? (
        <Grid size={{ xs: 12, md: 6 }}>
          <AddressCard
            title={
              storeName?.trim() ||
              t('orders.pickupLocator.address', 'Store address')
            }
            address={address}
            showNavigate
          />
        </Grid>
      ) : null}
      {hasContact ? (
        <Grid size={{ xs: 12, md: 6 }}>
          <ContactCard
            title={t('orders.pickupLocator.contact', 'Store contact')}
            contact={contact}
          />
        </Grid>
      ) : null}
    </Grid>
  );
}
