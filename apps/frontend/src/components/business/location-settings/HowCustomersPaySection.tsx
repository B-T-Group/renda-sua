import { Alert, Collapse, Skeleton, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingToggleRow from './SettingToggleRow';
import { isOwnerForbidden, LocationSectionActions } from './sectionTypes';

const SHORT =
  'When on, customers order first. After you confirm, they have 45 minutes to pay with Mobile Money (3 hours for cooked food). Unpaid orders are cancelled and the stock goes back on sale.';

const HowCustomersPaySection: React.FC<LocationSectionActions> = (props) => {
  const { location, isStripeRail, railLoading, isOwnBusiness, updateLocation } =
    props;
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [checked, setChecked] = useState(location.pay_at_confirm === true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (railLoading) return <Skeleton variant="rounded" height={96} />;
  if (isStripeRail) return null;

  const commit = async (next: boolean) => {
    if (!isOwnBusiness) return;
    const previous = checked;
    setChecked(next);
    setError(null);
    try {
      await updateLocation(location.id, { pay_at_confirm: next });
      enqueueSnackbar(
        t('business.locations.payAfter.saved', 'Payment setting saved'),
        { variant: 'success' }
      );
    } catch (err: unknown) {
      setChecked(previous);
      setError(
        isOwnerForbidden(err)
          ? t(
              'business.locations.payAfter.ownerOnly',
              'Only the business owner can change this.'
            )
          : t(
              'business.locations.payAfter.saveFailed',
              "Couldn't save how customers pay. Please try again."
            )
      );
    }
  };

  return (
    <Stack spacing={1} component="section" aria-label={t('business.locations.payAfter.section', 'How customers pay')}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t('business.locations.payAfter.section', 'How customers pay')}
      </Typography>
      <SettingToggleRow
        label={t(
          'business.locations.payAfter.label',
          'Ask customers to pay after you confirm'
        )}
        consequence={t('business.locations.payAfter.short', SHORT)}
        checked={checked}
        disabled={!isOwnBusiness}
        onCommit={(next) => void commit(next)}
        confirmFor={(next) => payConfirm(next, t)}
      />
      <Typography
        variant="body2"
        color="primary"
        sx={{ cursor: 'pointer' }}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {t('business.locations.payAfter.goodToKnow', 'Good to know')}
      </Typography>
      <Collapse in={detailsOpen}>
        <PayAfterDetails />
      </Collapse>
      <Typography variant="caption" color="text.secondary">
        {t(
          'business.locations.payAfter.ownerOnly',
          'Only the business owner can change this.'
        )}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
};

function payConfirm(
  next: boolean,
  t: (key: string, fallback: string) => string
) {
  if (next) {
    return {
      title: t(
        'business.locations.payAfter.turnOnTitle',
        'Turn on pay after you confirm?'
      ),
      body: t(
        'business.locations.payAfter.turnOnBody',
        `${SHORT} Customers will see 'Pay after the store confirms' on this location's items.`
      ),
      confirmLabel: t('business.locations.payAfter.turnOn', 'Turn on'),
    };
  }
  return {
    title: t(
      'business.locations.payAfter.turnOffTitle',
      'Turn off pay after you confirm?'
    ),
    body: t(
      'business.locations.payAfter.turnOffBody',
      'Customers will pay when they order, as set on each item.'
    ),
    confirmLabel: t('business.locations.payAfter.turnOff', 'Turn off'),
  };
}

function PayAfterDetails() {
  const { t } = useTranslation();
  const bullets = [
    t('business.locations.payAfter.bulletMomo', 'Applies to Mobile Money pickup and delivery orders.'),
    t('business.locations.payAfter.bulletAsap', "Customers can only order for as soon as possible — they can't schedule for later."),
    t('business.locations.payAfter.bulletCart', 'If a basket has items from this location, the whole basket is paid after you confirm.'),
    t('business.locations.payAfter.bulletWallet', 'Customers whose Rendasua wallet covers the order still pay right away.'),
    t('business.locations.payAfter.bulletDeposit', 'No reservation deposit is taken.'),
    t('business.locations.payAfter.bulletCancel', 'You can cancel an order even after it\'s paid (for example, out of stock). The customer is refunded in full.'),
    t('business.locations.payAfter.bulletShipping', "Shipping and rentals aren't affected."),
    t('business.locations.payAfter.bulletFood', 'Cooked food is already paid after you confirm, whether or not this is on.'),
  ];
  return (
    <Stack component="ul" spacing={0.5} sx={{ pl: 2, m: 0 }}>
      {bullets.map((text) => (
        <Typography key={text} component="li" variant="body2" color="text.secondary">
          {text}
        </Typography>
      ))}
    </Stack>
  );
}

export default HowCustomersPaySection;
