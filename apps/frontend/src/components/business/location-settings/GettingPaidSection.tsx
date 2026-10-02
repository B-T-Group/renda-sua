import {
  Button,
  Link as MuiLink,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useBusinessAccountType } from '../../../hooks/useBusinessAccountType';
import {
  MobilePaymentPhone,
  useMobilePaymentPhones,
} from '../../../hooks/useMobilePaymentPhones';
import { MobilePaymentPhoneVerifyModal } from '../../dialogs/MobilePaymentPhoneVerifyModal';
import SettingToggleRow from './SettingToggleRow';
import { LocationSectionActions } from './sectionTypes';

const GettingPaidSection: React.FC<LocationSectionActions> = ({
  location,
  isStripeRail,
  railLoading,
  updateLocation,
}) => {
  const { t } = useTranslation();
  if (railLoading) return <Skeleton variant="rounded" height={120} />;
  return (
    <Stack spacing={2} component="section">
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {t('business.locations.gettingPaid.title', 'Getting paid')}
      </Typography>
      {isStripeRail ? (
        <StripePhone location={location} updateLocation={updateLocation} />
      ) : (
        <MomoNumber location={location} updateLocation={updateLocation} />
      )}
      {!isStripeRail ? (
        <AutoPayout location={location} updateLocation={updateLocation} />
      ) : null}
      <FeeLine />
    </Stack>
  );
};

function StripePhone({
  location,
  updateLocation,
}: Pick<LocationSectionActions, 'location' | 'updateLocation'>) {
  const { t } = useTranslation();
  const [phone, setPhone] = useState(location.phone ?? '');
  const [editing, setEditing] = useState(false);
  useEffect(() => setPhone(location.phone ?? ''), [location.phone]);
  const save = async () => {
    await updateLocation(location.id, { phone: phone.trim() });
    setEditing(false);
  };
  return (
    <Stack spacing={1}>
      <Typography variant="body1">
        {t('business.locations.gettingPaid.phoneLabel', 'Phone number')}
      </Typography>
      {editing ? (
        <TextField
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          fullWidth
        />
      ) : (
        <Typography variant="body2">{location.phone || '—'}</Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.locations.gettingPaid.phoneHelp',
          'How customers and Rendasua can reach this location.'
        )}
      </Typography>
      <Button variant={editing ? 'contained' : 'text'} onClick={() => (editing ? void save() : setEditing(true))}>
        {editing
          ? t('common.save', 'Save')
          : t('common.edit', 'Edit')}
      </Button>
    </Stack>
  );
}

function MomoNumber({
  location,
  updateLocation,
}: Pick<LocationSectionActions, 'location' | 'updateLocation'>) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { phones, deletePhone, fetchPhones } = useMobilePaymentPhones();
  const [open, setOpen] = useState(false);
  const linked = location.mobile_payment_phone;
  const verified = linked?.is_verified === true;
  const help = momoHelp(!!linked, verified, t);

  const link = async (phoneId: string | null) => {
    await updateLocation(location.id, { mobile_payment_phone_id: phoneId });
  };

  const remove = async () => {
    const phoneId = location.mobile_payment_phone_id;
    if (!phoneId) return;
    await updateLocation(location.id, { mobile_payment_phone_id: null });
    try {
      await deletePhone(phoneId);
    } catch {
      enqueueSnackbar(
        t('mobilePaymentPhone.unlinked', 'Mobile payment number unlinked from this location'),
        { variant: 'success' }
      );
    }
  };

  return (
    <Stack spacing={1}>
      <Typography variant="body1">
        {t('business.locations.gettingPaid.momoLabel', 'Mobile Money number')}
      </Typography>
      <Typography variant="body2">{linked?.phone_e164 || t('business.locations.gettingPaid.noNumber', 'No number yet')}</Typography>
      <Typography variant="body2" color="text.secondary">{help}</Typography>
      <Select
        value={location.mobile_payment_phone_id ?? ''}
        displayEmpty
        onChange={(event) => void link(event.target.value || null)}
      >
        <MenuItem value="">{t('business.locations.gettingPaid.noNumber', 'No number yet')}</MenuItem>
        {phones.map((phone) => (
          <MenuItem key={phone.id} value={phone.id}>
            {phone.phone_e164}
            {phone.is_verified
              ? ` · ${t('mobilePaymentPhone.verified', 'Verified')}`
              : ''}
          </MenuItem>
        ))}
      </Select>
      <Stack direction="row" spacing={1}>
        <Button variant="text" onClick={() => setOpen(true)}>
          {linked
            ? t('mobilePaymentPhone.verifyCta', 'Verify mobile money number')
            : t('business.locations.gettingPaid.addNumber', 'Add a number')}
        </Button>
        {linked ? (
          <Button variant="text" color="inherit" onClick={() => void remove()}>
            {t('common.remove', 'Remove')}
          </Button>
        ) : null}
      </Stack>
      <MobilePaymentPhoneVerifyModal
        open={open}
        mode={linked ? 'verify' : 'add'}
        initialPhone={linked ? (linked as MobilePaymentPhone) : null}
        onClose={() => setOpen(false)}
        onCompleted={(phone) => {
          void link(phone.id).then(() => fetchPhones());
          setOpen(false);
        }}
      />
    </Stack>
  );
}

function AutoPayout({
  location,
  updateLocation,
}: Pick<LocationSectionActions, 'location' | 'updateLocation'>) {
  const { t } = useTranslation();
  const [on, setOn] = useState(location.auto_withdraw_commissions !== false);
  useEffect(() => {
    setOn(location.auto_withdraw_commissions !== false);
  }, [location.auto_withdraw_commissions]);
  const commit = async (next: boolean) => {
    const previous = on;
    setOn(next);
    try {
      await updateLocation(location.id, { auto_withdraw_commissions: next });
    } catch {
      setOn(previous);
    }
  };
  return (
    <Stack spacing={0.5}>
      <SettingToggleRow
        label={t(
          'business.locations.gettingPaid.autoLabel',
          'Send my money to this number automatically'
        )}
        consequence={
          on
            ? t(
                'business.locations.gettingPaid.autoOn',
                "Each time a sale's money reaches this location, we send it to your number."
              )
            : t(
                'business.locations.gettingPaid.autoOff',
                "Money stays in this location's account until you withdraw it from your Wallet."
              )
        }
        checked={on}
        onCommit={(next) => void commit(next)}
      />
      {on && !location.mobile_payment_phone_id ? (
        <Typography variant="body2" color="warning.dark">
          {t(
            'business.locations.gettingPaid.autoNeedsNumber',
            'Add a Mobile Money number for automatic payouts to work.'
          )}
        </Typography>
      ) : null}
    </Stack>
  );
}

function FeeLine() {
  const { t } = useTranslation();
  const { plan } = useBusinessAccountType();
  return (
    <Typography variant="body2" color="text.secondary">
      {t('business.locations.gettingPaid.feeLabel', 'Rendasua fee')}{' '}
      {t('business.locations.gettingPaid.feeValue', '{{pct}}% of item sales, set by your business plan.', {
        pct: plan.commissionPercent,
      })}{' '}
      <MuiLink component={RouterLink} to="/business/account-type">
        {t('business.locations.gettingPaid.seePlans', 'See plans')}
      </MuiLink>
    </Typography>
  );
}

function momoHelp(
  hasNumber: boolean,
  verified: boolean,
  t: (key: string, fallback: string) => string
): string {
  if (!hasNumber) {
    return t(
      'business.locations.gettingPaid.momoNone',
      'No number yet. Add one so customers can buy from this location.'
    );
  }
  if (!verified) {
    return t(
      'business.locations.gettingPaid.momoUnverified',
      "Not verified yet. Customers can't buy from this location until you verify it."
    );
  }
  return t(
    'business.locations.gettingPaid.momoVerified',
    'Verified. Your sales are paid out to this number.'
  );
}

export default GettingPaidSection;
