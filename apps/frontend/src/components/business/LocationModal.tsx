import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Address } from '../../contexts/UserProfileContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import {
  AddBusinessLocationData,
  BusinessLocation,
  UpdateBusinessLocationData,
} from '../../hooks/useBusinessLocations';
import { useMobilePaymentPhones } from '../../hooks/useMobilePaymentPhones';
import { getCountryStateCity } from '../../utils/countryStateCityLoader';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';
import { MobilePaymentPhoneVerifyModal } from '../dialogs/MobilePaymentPhoneVerifyModal';

async function profileAddressToFormData(addr: Address): Promise<AddressFormData> {
  const { State } = await getCountryStateCity();
  const state = State.getStateByCodeAndCountry(addr.state, addr.country);
  return {
    address_line_1: addr.address_line_1,
    address_line_2: addr.address_line_2 || '',
    city: addr.city,
    state: state?.name ?? addr.state,
    postal_code: addr.postal_code,
    country: addr.country,
    instructions: addr.instructions || '',
  };
}

interface LocationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: AddBusinessLocationData | UpdateBusinessLocationData
  ) => Promise<void>;
  location?: BusinessLocation | null;
  businessPrimaryCountry?: string | null;
  businessId?: string | null;
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
}

const EMPTY_ADDRESS: AddressFormData = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
  instructions: '',
};

/** Create-only location dialog. Editing happens on the location settings page. */
const LocationModal: React.FC<LocationModalProps> = ({
  open,
  onClose,
  onSave,
  location,
  businessPrimaryCountry = null,
  businessId = null,
  loading = false,
  error = null,
  warning = null,
}) => {
  const { t } = useTranslation();
  const { isStripeRail, loading: railLoading } = useIsStripeRail();
  const { phones, fetchPhones } = useMobilePaymentPhones(!isStripeRail && open);
  const { profile } = useUserProfileContext();
  const [locationType, setLocationType] = useState<
    BusinessLocation['location_type']
  >('store');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentPhoneId, setPaymentPhoneId] = useState<string | null>(null);
  const [address, setAddress] = useState<AddressFormData>(EMPTY_ADDRESS);
  const [reuseProfile, setReuseProfile] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const businessProfileAddress = useMemo(() => {
    const list = profile?.addresses;
    if (!list?.length) return null;
    return list.find((item) => item.is_primary) ?? list[0];
  }, [profile?.addresses]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setLocationType('store');
    setPhone('');
    setPaymentPhoneId(null);
    setReuseProfile(false);
    setNameError(null);
    setAddressError(null);
    setAddress({ ...EMPTY_ADDRESS, country: businessPrimaryCountry ?? '' });
  }, [open, businessPrimaryCountry, location, businessId]);

  const save = async () => {
    if (!name.trim()) {
      setNameError(t('business.locations.basics.nameRequired', 'Enter a name.'));
      return;
    }
    const hasAddress =
      reuseProfile ||
      (!!address.address_line_1.trim() &&
        !!address.city.trim() &&
        !!address.state.trim() &&
        !!address.country.trim());
    if (!hasAddress) {
      setAddressError(
        t(
          'business.locations.basics.addressRequired',
          'Add an address for this location.'
        )
      );
      return;
    }
    const payload: AddBusinessLocationData = {
      name: name.trim(),
      location_type: locationType,
      is_primary: false,
      auto_withdraw_commissions: isStripeRail ? false : true,
      phone: isStripeRail ? phone.trim() : undefined,
      mobile_payment_phone_id: isStripeRail ? null : paymentPhoneId,
    };
    if (reuseProfile && businessProfileAddress) {
      await onSave({ ...payload, address_id: businessProfileAddress.id });
      return;
    }
    await onSave({
      ...payload,
      address: {
        ...address,
        postal_code: address.postal_code?.trim() || '',
      },
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('business.locations.addLocation', 'Add location')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {warning ? <Alert severity="warning">{warning}</Alert> : null}
          <Select
            value={locationType}
            onChange={(event) =>
              setLocationType(
                event.target.value as BusinessLocation['location_type']
              )
            }
            inputProps={{
              'aria-label': t('business.locations.more.kind', 'Kind of place'),
            }}
          >
            {(['store', 'warehouse', 'office', 'pickup_point'] as const).map(
              (type) => (
                <MenuItem key={type} value={type}>
                  {t(
                    `business.locations.${type}`,
                    type === 'pickup_point' ? 'Pickup point' : type
                  )}
                </MenuItem>
              )
            )}
          </Select>
          <TextField
            label={t('business.locations.locationName', 'Location name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={!!nameError}
            helperText={
              nameError ||
              t(
                'business.locations.locationNameHintWithoutLogo',
                'Enter your shop name and the city, e.g. Rendasua – Akwa'
              )
            }
            required
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {businessProfileAddress ? (
              <Button variant="outlined" onClick={() => void reuseAddress(businessProfileAddress, setReuseProfile, setAddress)}>
                {t('business.locations.useBusinessProfileAddress', 'Use my business address')}
              </Button>
            ) : null}
            <Button variant="text" onClick={() => setAddressOpen(true)}>
              {t('business.locations.addLocationAddress', 'Add a different address')}
            </Button>
          </Stack>
          {addressError ? (
            <Typography variant="body2" color="error">{addressError}</Typography>
          ) : null}
          {reuseProfile ? (
            <Typography variant="body2" color="text.secondary">
              {t('business.locations.usingBusinessProfileAddress', 'Using your business profile address')}
            </Typography>
          ) : null}
          {railLoading ? null : isStripeRail ? (
            <TextField
              label={t('business.locations.phone', 'Phone')}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              fullWidth
            />
          ) : (
            <MomoPicker
              phones={phones}
              value={paymentPhoneId}
              onChange={setPaymentPhoneId}
              onAdd={() => setPhoneModalOpen(true)}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{t('common.cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={loading}>
          {t('business.locations.addLocation', 'Add location')}
        </Button>
      </DialogActions>
      <AddressDialog
        open={addressOpen}
        onClose={() => setAddressOpen(false)}
        addressData={address}
        onAddressChange={setAddress}
        onSave={() => {
          setReuseProfile(false);
          setAddressOpen(false);
          setAddressError(null);
        }}
        title={t('business.locations.addLocationAddress', 'Add location address')}
      />
      <MobilePaymentPhoneVerifyModal
        open={phoneModalOpen}
        mode="add"
        onClose={() => setPhoneModalOpen(false)}
        onCompleted={(saved) => {
          setPaymentPhoneId(saved.id);
          void fetchPhones();
          setPhoneModalOpen(false);
        }}
      />
    </Dialog>
  );
};

function reuseAddress(
  addr: Address,
  setReuse: (value: boolean) => void,
  setAddress: (value: AddressFormData) => void
) {
  setReuse(true);
  void profileAddressToFormData(addr).then(setAddress);
}

function MomoPicker({
  phones,
  value,
  onChange,
  onAdd,
}: {
  phones: Array<{ id: string; phone_e164: string; is_verified: boolean }>;
  value: string | null;
  onChange: (id: string | null) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1}>
      <Typography variant="body2">
        {t('business.locations.gettingPaid.momoLabel', 'Mobile Money number')}
      </Typography>
      <Select
        value={value ?? ''}
        displayEmpty
        onChange={(event) => onChange(event.target.value || null)}
      >
        <MenuItem value="">
          {t('business.locations.gettingPaid.noNumber', 'No number yet')}
        </MenuItem>
        {phones.map((phone) => (
          <MenuItem key={phone.id} value={phone.id}>
            {phone.phone_e164}
          </MenuItem>
        ))}
      </Select>
      <Button variant="text" onClick={onAdd}>
        {t('business.locations.gettingPaid.addNumber', 'Add a number')}
      </Button>
    </Stack>
  );
}

export default LocationModal;
