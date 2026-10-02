import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { businessApi } from '../../services/businessApi';
import { uploadBusinessLocationLogo } from '../../services/businessLocationLogoUpload';
import type {
  BusinessLocation,
  CreateBusinessLocationPayload,
  UpdateBusinessLocationPayload,
} from '../../types/business/locations';
import type { MobilePaymentPhone } from '../../types/mobilePaymentPhone';
import type { DeliveryAddressFormValue } from '../../components/forms/DeliveryAddressForm';
import {
  IMAGE_LIBRARY_PICKER_OPTIONS,
  isSupportedImageAsset,
} from '../../utils/supportedImageFormats';
import { useProfileMe } from '../useProfileMe';
import { useIsStripeRail } from '../useIsStripeRail';
import { useMobilePaymentPhones } from '../useMobilePaymentPhones';

const LOCATION_TYPES: BusinessLocation['location_type'][] = [
  'store',
  'warehouse',
  'office',
  'pickup_point',
];

function normalizeOrderAlertPhone(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const digits = raw.replace(/^\+/, '').replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

/** Prefer primary location’s verified phone, else any verified location, else registry. */
function resolveDefaultMobilePaymentPhoneId(
  locations: BusinessLocation[],
  phones: MobilePaymentPhone[]
): string | null {
  const primary = locations.find((l) => l.is_primary) ?? locations[0];
  if (primary?.mobile_payment_phone?.is_verified) {
    return (
      primary.mobile_payment_phone_id ??
      primary.mobile_payment_phone.id ??
      null
    );
  }
  const verifiedLoc = locations.find((l) => l.mobile_payment_phone?.is_verified);
  if (verifiedLoc) {
    return (
      verifiedLoc.mobile_payment_phone_id ??
      verifiedLoc.mobile_payment_phone?.id ??
      null
    );
  }
  return phones.find((p) => p.is_verified)?.id ?? null;
}

function createPayloadFromForm(input: {
  name: string;
  isStripeRail: boolean;
  phone: string;
  mobilePaymentPhoneId: string | null;
  addressForm: DeliveryAddressFormValue;
}): CreateBusinessLocationPayload {
  return {
    name: input.name.trim(),
    location_type: 'store',
    ...(input.isStripeRail
      ? { phone: input.phone.trim() || undefined, auto_withdraw_commissions: false }
      : { mobile_payment_phone_id: input.mobilePaymentPhoneId, auto_withdraw_commissions: true }),
    address: {
      address_line_1: input.addressForm.address_line_1.trim(),
      address_line_2: input.addressForm.address_line_2?.trim(),
      city: input.addressForm.city.trim(),
      state: input.addressForm.state,
      postal_code: input.addressForm.postal_code?.trim(),
      latitude: input.addressForm.latitude,
      longitude: input.addressForm.longitude,
    },
  };
}

function ownerErrorMessage(
  err: unknown,
  t: (key: string, fallback: string) => string
): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status === 403) {
    return t(
      'business.locations.payAfter.ownerOnly',
      'Only the business owner can change this.'
    );
  }
  return err instanceof Error
    ? err.message
    : t('business.locations.saveError', 'Failed to save location');
}

type Nav = NativeStackNavigationProp<BusinessRootStackParamList, 'BusinessLocationForm'>;

export function useBusinessLocationForm(
  locationId: string | undefined,
  navigation: Nav
) {
  const { t } = useTranslation();
  const { me } = useProfileMe();
  const { isStripeRail, loading: railLoading } = useIsStripeRail();
  const { phones, fetchPhones, verificationMethod } = useMobilePaymentPhones(!isStripeRail);
  const businessId = me?.business?.id ?? '';
  const isEditing = !!locationId;

  const [loading, setLoading] = useState(!!locationId);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [primaryCountry, setPrimaryCountry] = useState<string | null>(null);
  const [existingLocations, setExistingLocations] = useState<BusinessLocation[]>(
    []
  );
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderAlertPhone, setOrderAlertPhone] = useState('');
  const [mobilePaymentPhoneId, setMobilePaymentPhoneId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [autoWithdraw, setAutoWithdraw] = useState(!isStripeRail);
  const [payAtConfirm, setPayAtConfirm] = useState(false);
  const [locationType, setLocationType] = useState<BusinessLocation['location_type']>('store');
  const [isPrimary, setIsPrimary] = useState(false);
  const [addressForm, setAddressForm] = useState<DeliveryAddressFormValue>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
  });
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [location, setLocation] = useState<BusinessLocation | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await businessApi.locations.list();
        if (!res.success) return;
        setPrimaryCountry(res.data.primary_address_country ?? null);
        setExistingLocations(res.data.business_locations ?? []);
        if (!locationId) {
          setAddressForm((prev) => ({
            ...prev,
            country: res.data.primary_address_country ?? prev.country,
          }));
          return;
        }
        const loc = res.data.business_locations.find((l) => l.id === locationId);
        if (!loc) return;
        setLocation(loc);
        setName(loc.name);
        setPhone(loc.phone ?? '');
        setOrderAlertPhone(loc.order_alert_phone ?? '');
        setMobilePaymentPhoneId(
          loc.mobile_payment_phone_id ?? loc.mobile_payment_phone?.id ?? null
        );
        setEmail(loc.email ?? '');
        setLogoUrl(loc.logo_url ?? '');
        setAutoWithdraw(loc.auto_withdraw_commissions !== false);
        setPayAtConfirm(loc.pay_at_confirm === true);
        setLocationType(loc.location_type);
        setIsPrimary(loc.is_primary);
        setAddressForm({
          address_line_1: loc.address.address_line_1,
          address_line_2: loc.address.address_line_2 ?? '',
          city: loc.address.city,
          state: loc.address.state,
          postal_code: loc.address.postal_code ?? '',
          country: loc.address.country,
          latitude: loc.address.latitude ? Number(loc.address.latitude) : undefined,
          longitude: loc.address.longitude ? Number(loc.address.longitude) : undefined,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [locationId]);

  useEffect(() => {
    if (isEditing || isStripeRail || mobilePaymentPhoneId) return;
    const defaultPhoneId = resolveDefaultMobilePaymentPhoneId(
      existingLocations,
      phones
    );
    if (defaultPhoneId) setMobilePaymentPhoneId(defaultPhoneId);
  }, [
    isEditing,
    isStripeRail,
    mobilePaymentPhoneId,
    existingLocations,
    phones,
  ]);

  const hasLogo = !!logoUrl.trim();
  const nameHint = hasLogo
    ? t(
        'business.locations.locationNameHintWithLogo',
        'If a logo is set, enter only the city where this shop is located (the logo already identifies your business).'
      )
    : t(
        'business.locations.locationNameHintWithoutLogo',
        'Without a logo, enter your shop name and the city, e.g. Rendasua - Akwa.'
      );

  const pickLogo = useCallback(async () => {
    if (!businessId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      ...IMAGE_LIBRARY_PICKER_OPTIONS,
    });
    if (result.canceled || !result.assets[0]) return;
    if (!isSupportedImageAsset(result.assets[0])) {
      setSaveError(
        t(
          'business.images.upload.unsupportedFormat',
          'Unsupported image format. Please use JPEG, PNG, or WebP.'
        )
      );
      return;
    }
    setUploadingLogo(true);
    setSaveError(null);
    try {
      const url = await uploadBusinessLocationLogo(result.assets[0], businessId);
      setLogoUrl(url);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error
          ? err.message
          : t('business.locations.logoUploadError', 'Failed to upload logo')
      );
    } finally {
      setUploadingLogo(false);
    }
  }, [businessId, t]);

  const save = useCallback(async () => {
    if (!name.trim()) {
      setSaveError(t('business.locations.basics.nameRequired', 'Enter a name.'));
      return;
    }
    if (!addressForm.address_line_1.trim() || !addressForm.city.trim()) {
      setSaveError(t('business.locations.basics.addressRequired', 'Add an address for this location.'));
      return;
    }
    setSaving(true);
    setSaveError(null);
    const logo = logoUrl.trim() ? logoUrl.trim() : null;

    try {
      if (locationId) {
        const updatePayload: UpdateBusinessLocationPayload = {
          name: name.trim(),
          ...(isStripeRail
            ? { phone: phone.trim() || undefined }
            : { mobile_payment_phone_id: mobilePaymentPhoneId }),
          order_alert_phone: normalizeOrderAlertPhone(orderAlertPhone),
          email: email.trim() || undefined,
          location_type: locationType,
          is_primary: isPrimary,
          logo_url: logo,
        };
        if (!isStripeRail) {
          updatePayload.auto_withdraw_commissions = autoWithdraw;
          updatePayload.pay_at_confirm = payAtConfirm;
        }
        await businessApi.locations.update(locationId, updatePayload);
        await businessApi.locations.patchAddress(locationId, {
          address_line_1: addressForm.address_line_1.trim(),
          address_line_2: addressForm.address_line_2?.trim() || undefined,
          city: addressForm.city.trim(),
          state: addressForm.state,
          postal_code: addressForm.postal_code?.trim() || undefined,
          country: addressForm.country || undefined,
          latitude: addressForm.latitude,
          longitude: addressForm.longitude,
        });
      } else {
        await businessApi.locations.create(createPayloadFromForm({
          name,
          isStripeRail,
          phone,
          mobilePaymentPhoneId,
          addressForm,
        }));
      }
      navigation.goBack();
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : t('business.locations.saveError', 'Failed to save location')
      );
    } finally {
      setSaving(false);
    }
  }, [
    name,
    phone,
    orderAlertPhone,
    email,
    locationType,
    isPrimary,
    autoWithdraw,
    payAtConfirm,
    logoUrl,
    addressForm,
    locationId,
    navigation,
    t,
    mobilePaymentPhoneId,
    isStripeRail,
  ]);

  const patchFields = useCallback(
    async (payload: UpdateBusinessLocationPayload) => {
      if (!locationId) return;
      setSaving(true);
      setSaveError(null);
      try {
        await businessApi.locations.update(locationId, payload);
        const res = await businessApi.locations.list();
        const next = res.data?.business_locations?.find((item) => item.id === locationId);
        if (next) setLocation(next);
      } catch (err: unknown) {
        setSaveError(ownerErrorMessage(err, t));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [locationId, t]
  );

  const saveBasics = useCallback(async () => {
    if (!name.trim()) {
      setSaveError(t('business.locations.basics.nameRequired', 'Enter a name.'));
      return;
    }
    await patchFields({
      name: name.trim(),
      email: email.trim() || undefined,
      logo_url: logoUrl.trim() ? logoUrl.trim() : null,
      ...(isStripeRail ? { phone: phone.trim() || undefined, auto_withdraw_commissions: false } : {}),
    });
  }, [email, isStripeRail, logoUrl, name, patchFields, phone, t]);

  const savePayments = useCallback(async () => {
    if (isStripeRail) {
      await patchFields({ phone: phone.trim() || undefined, auto_withdraw_commissions: false });
      return;
    }
    await patchFields({
      mobile_payment_phone_id: mobilePaymentPhoneId,
      auto_withdraw_commissions: autoWithdraw,
    });
  }, [autoWithdraw, isStripeRail, mobilePaymentPhoneId, patchFields, phone]);

  const savePayAtConfirm = useCallback(
    async (next: boolean) => {
      await patchFields({ pay_at_confirm: next });
      setPayAtConfirm(next);
    },
    [patchFields]
  );

  const saveAlerts = useCallback(async () => {
    const trimmed = orderAlertPhone.trim();
    if (trimmed && !trimmed.startsWith('+')) {
      setSaveError(t('business.locations.alerts.countryCode', 'Enter the number with its country code.'));
      return;
    }
    await patchFields({ order_alert_phone: normalizeOrderAlertPhone(orderAlertPhone) });
  }, [orderAlertPhone, patchFields, t]);

  const saveAddress = useCallback(async () => {
    if (!locationId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await businessApi.locations.patchAddress(locationId, {
        address_line_1: addressForm.address_line_1.trim(),
        address_line_2: addressForm.address_line_2?.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state,
        postal_code: addressForm.postal_code?.trim() || undefined,
        country: addressForm.country || undefined,
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
      });
    } catch (err: unknown) {
      setSaveError(ownerErrorMessage(err, t));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [addressForm, locationId, t]);

  const makeMain = useCallback(async () => {
    if (!locationId) return;
    const previous = existingLocations.find(
      (item) => item.is_primary && item.id !== locationId
    );
    await patchFields({ is_primary: true });
    if (!previous) return;
    try {
      await businessApi.locations.update(previous.id, { is_primary: false });
    } catch {
      setSaveError(
        t(
          'business.locations.more.mainPartial',
          'This location is main, but the previous one could not be updated. You may have two main locations until you try again.'
        )
      );
    }
  }, [existingLocations, locationId, patchFields, t]);

  const saveActive = useCallback(
    async (next: boolean) => {
      await patchFields({ is_active: next });
    },
    [patchFields]
  );

  const locationTypeOptions = useMemo(
    () =>
      LOCATION_TYPES.map((value) => ({
        value,
        label: t(`business.locations.${value}`, value),
      })),
    [t]
  );

  return {
    loading,
    saving,
    uploadingLogo,
    isEditing,
    primaryCountry,
    name,
    setName,
    nameHint,
    phone,
    setPhone,
    orderAlertPhone,
    setOrderAlertPhone,
    mobilePaymentPhoneId,
    setMobilePaymentPhoneId,
    phones,
    verificationMethod,
    fetchPhones,
    isStripeRail,
    email,
    setEmail,
    logoUrl,
    setLogoUrl,
    pickLogo,
    autoWithdraw,
    setAutoWithdraw,
    payAtConfirm,
    setPayAtConfirm,
    locationType,
    setLocationType,
    locationTypeOptions,
    isPrimary,
    setIsPrimary,
    addressForm,
    setAddressForm,
    addressModalOpen,
    setAddressModalOpen,
    saveError,
    save,
    location,
    railLoading,
    saveBasics,
    savePayments,
    savePayAtConfirm,
    saveAlerts,
    saveAddress,
    saveActive,
    makeMain,
    patchFields,
  };
}
