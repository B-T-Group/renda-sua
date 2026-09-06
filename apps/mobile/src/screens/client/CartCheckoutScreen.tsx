import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppModal } from '../../components/common/AppModal';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import type { ClientRootStackParamList } from '../../navigation/types';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';
import { agentApi } from '../../services/agentApi';
import { checkoutAnalytics } from '../../services/checkoutAnalytics';
import { nextDeliveryUnavailableLatch } from '../../utils/deliveryAvailabilityLatch';
import { useClientAddresses } from '../../hooks/useClientAddresses';
import { useClientProfileForPlaceOrder } from '../../hooks/useClientProfileForPlaceOrder';
import { useCheckoutOrchestrator } from '../../hooks/useCheckoutOrchestrator';
import { usePlaceOrderDiscountCode } from '../../hooks/usePlaceOrderDiscountCode';
import { useCartDeliveryFees } from '../../hooks/useCartDeliveryFees';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useResolvedCheckout } from '../../hooks/useResolvedCheckout';
import useUpdateClientProfile from '../../hooks/useUpdateClientProfile';
import { PlaceOrderDeliveryWindowBlock } from '../../components/browse/PlaceOrderDeliveryWindowBlock';
import { PlaceOrderPaymentBlock } from '../../components/browse/PlaceOrderPaymentBlock';
import { AddPaymentPhoneDialog } from '../../components/dialogs/AddPaymentPhoneDialog';
import { ActionLoadingDialog } from '../../components/feedback/ActionLoadingDialog';
import { PlaceOrderAddressStep } from '../../components/place-order/PlaceOrderAddressStep';
import { PlaceOrderDeliveryAddressBlock } from '../../components/place-order/PlaceOrderDeliveryAddressBlock';
import {
  PlaceOrderFulfillmentChoice,
  type OrderFulfillment,
} from '../../components/place-order/PlaceOrderFulfillmentChoice';
import { AddressCapture } from '../../components/forms/AddressCapture';
import type { DeliveryAddressFormValue } from '../../components/forms/DeliveryAddressForm';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { DiasporaCheckoutBanner } from '../../components/checkout/DiasporaCheckoutBanner';
import { RecipientPicker } from '../../components/checkout/RecipientPicker';
import { PayerChargeSummary } from '../../components/checkout/PayerChargeSummary';
import { CartCheckoutSummaryCard } from '../../components/cart/CartCheckoutSummaryCard';
import { CheckoutProgressStepper } from '../../components/checkout/CheckoutProgressStepper';
import { PaymentMethodLockedRow } from '../../components/checkout/PaymentMethodLockedRow';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';
import { pickMobileMoneyDefaultCountry, validateOrderPaymentPhone, validateOrderPaymentPhoneForCountry } from '../../utils/placeOrderPhoneValidation';
import { alignCatalogAddressToCscFields } from '../../utils/addressRegionMatch';
import { getCountryDisplayName } from '../../utils/phoneCountryOptions';
import { checkoutPreflightBlocker } from '../../utils/checkoutPreflightBlocker';
import { isAddressComplete } from '../../utils/addressCompleteness';
import { resolveMoMoDisplayCountryIso } from '../../utils/momoCountryDisplay';
import {
  cartShippingAvailability,
  fulfillmentNeedsAddress,
  fulfillmentNeedsWindow,
} from '../../utils/fulfillmentMethod';
import { useCompleteAddressPrompt } from '../../hooks/useCompleteAddressPrompt';
import { toOrderItemVariantId } from '../../utils/shopperVariantSelection';
import type { CartLine } from '../../types/cart';
import type { RecipientContact } from '../../types/clientOrder';
import {
  addressesInCountry,
  buildRecipientPayload,
  dropOffAddressesForFulfillment,
  isRecipientDraftIncomplete,
  needsRecipientDeliveryAddress,
  normalizeCountryIso,
  requiresStripePayNow,
  usableDeliveryAddressId,
} from '../../utils/diasporaCheckout';

type PayTiming = 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';
type Fulfillment = OrderFulfillment;

const BLANK_ADDRESS_FORM: DeliveryAddressFormValue = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

function deliverySumFromMap(byBusiness: Map<string, import('../../types/placeOrderPricing').ItemDeliveryFeeResponse | null>): number {
  let s = 0;
  byBusiness.forEach((v) => {
    if (v) s += Number(v.deliveryFee) || 0;
  });
  return s;
}

export default observer(function CartCheckoutScreen() {
  const { t, i18n } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = useKeyboardVerticalOffset();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const { cart } = useStore();
  const { addresses, loading: addrLoading, error: addrError, refetch: refetchAddresses } = useClientAddresses();
  const { user: meUser, loading: profileLoading, refetch: refetchProfile } = useClientProfileForPlaceOrder();
  const { updateClientProfile, loading: savingProfilePhone } = useUpdateClientProfile();
  const { isStripeRail, loading: stripeRailLoading } = useIsStripeRail();
  const { placeCartOrders, submitting } = useCheckoutOrchestrator();
  const { openPrompt, Prompt: CompleteAddressPromptEl } = useCompleteAddressPrompt();

  const cartItemsForPreflight = useMemo(
    () =>
      cart.items.map((l) => {
        const orderVariantId = toOrderItemVariantId(l.variantId);
        return {
          business_inventory_id: l.inventoryItemId,
          quantity: l.quantity,
          ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
        };
      }),
    [cart.items]
  );

  // Use the first cart item's seller country as provisional fallback while no address is selected.
  const provisionalCountry = cart.items[0]?.sellerCountry?.trim().toUpperCase();

  const [addressId, setAddressId] = useState('');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  // Delivery is the default when both options exist; confirmed immediately.
  const [hasChosenFulfillment, setHasChosenFulfillment] = useState(true);
  const [couponExpanded, setCouponExpanded] = useState(false);
  const [payTiming, setPayTiming] = useState<PayTiming>('pay_now');
  const [instructions, setInstructions] = useState('');
  const [snack, setSnack] = useState<string | null>(null);
  const [deliveryScheduleOk, setDeliveryScheduleOk] = useState(true);
  const [deliveryWindow, setDeliveryWindow] = useState<ClientDeliveryWindowPayload | null>(null);
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overrideCountryIso, setOverrideCountryIso] = useState<CountryCode>(() =>
    pickMobileMoneyDefaultCountry()
  );
  const [overrideNationalDigits, setOverrideNationalDigits] = useState('');
  const [addPhoneDialogVisible, setAddPhoneDialogVisible] = useState(false);
  const [phoneDialogDefaultCountry, setPhoneDialogDefaultCountry] = useState<CountryCode | undefined>(undefined);
  const [addAddressModalVisible, setAddAddressModalVisible] = useState(false);
  const [addAddressForm, setAddAddressForm] = useState<DeliveryAddressFormValue>(BLANK_ADDRESS_FORM);
  const [addAddressSaving, setAddAddressSaving] = useState(false);
  
  // Diaspora checkout state
  const [someoneElseReceiving, setSomeoneElseReceiving] = useState(false);
  const [recipient, setRecipient] = useState<Partial<RecipientContact>>({
    name: '',
    phone: '',
    notify_whatsapp: false,
  });
  const onSomeoneElseChange = useCallback((value: boolean) => {
    setSomeoneElseReceiving(value);
    if (!value) {
      setRecipient({ name: '', phone: '', notify_whatsapp: false });
    }
  }, []);

  const fulfillmentCountryIso = (provisionalCountry ?? '').trim().toUpperCase();
  const captureRecipientAddress = needsRecipientDeliveryAddress(
    someoneElseReceiving,
    fulfillmentNeedsAddress(fulfillment)
  );
  const payerCountryIso = normalizeCountryIso(
    addresses.find((a) => a.is_primary)?.country ?? addresses[0]?.country
  );
  const sendingOrderHome = Boolean(
    fulfillmentCountryIso && payerCountryIso && payerCountryIso !== fulfillmentCountryIso
  );
  const hideShopperAddressBook =
    sendingOrderHome &&
    !someoneElseReceiving &&
    fulfillmentNeedsAddress(fulfillment);
  const addressesForDelivery = useMemo(
    () =>
      dropOffAddressesForFulfillment(
        addresses,
        fulfillmentCountryIso,
        fulfillmentNeedsAddress(fulfillment)
      ),
    [addresses, fulfillment, fulfillmentCountryIso]
  );
  const deliveryAddressId = usableDeliveryAddressId(addressId, addressesForDelivery);

  const preflightRequest = useMemo(() => {
    if (cartItemsForPreflight.length === 0) return null;
    if (fulfillmentNeedsAddress(fulfillment) && deliveryAddressId) {
      return {
        items: cartItemsForPreflight,
        fulfillment_method: fulfillment,
        delivery_address_id: deliveryAddressId,
      };
    }
    if (provisionalCountry) {
      return {
        items: cartItemsForPreflight,
        fulfillment_method: fulfillment,
        provisional_country: provisionalCountry,
      };
    }
    return null;
  }, [cartItemsForPreflight, deliveryAddressId, fulfillment, provisionalCountry]);
  const { config: preflightConfig, loading: preflightLoading } = useResolvedCheckout({
    request: preflightRequest,
    enabled: cartItemsForPreflight.length > 0,
  });

  const checkoutBlocker = useMemo(
    () => checkoutPreflightBlocker(preflightConfig, preflightLoading),
    [preflightConfig, preflightLoading]
  );

  // Payment rail resolution: prefer preflight config over legacy buyer-rail hook.
  // Preflight is server-authoritative and considers payer country, seller country,
  // diaspora status, and payment account setup.
  const resolvedIsStripeRail = preflightConfig
    ? preflightConfig.checkout_method === 'STRIPE'
    : isStripeRail;

  // Store pickup is offered only when every seller group supports it.
  const pickupEligible = useMemo(() => {
    const groups = preflightConfig?.groups ?? [];
    return groups.length > 0 && groups.every((g) => g.pickup_eligible === true);
  }, [preflightConfig]);

  const { eligible: shippingEligible, partial: shippingPartial } = useMemo(
    () => cartShippingAvailability(preflightConfig?.groups ?? []),
    [preflightConfig]
  );

  const fulfillmentConfirmed =
    !(pickupEligible || shippingEligible) || hasChosenFulfillment;

  // Sticky latch: preflight only returns delivery_availability for delivery
  // fulfillment. Keep Delivery grayed out after auto-switching to pickup.
  const [deliveryUnavailable, setDeliveryUnavailable] = useState(false);
  useEffect(() => {
    setDeliveryUnavailable((prev) =>
      nextDeliveryUnavailableLatch(prev, preflightConfig?.delivery_availability)
    );
  }, [preflightConfig?.delivery_availability]);

  // Funnel analytics: track the first time the unavailable notice is shown.
  const unavailableTrackedRef = useRef(false);
  useEffect(() => {
    if (deliveryUnavailable && !unavailableTrackedRef.current) {
      unavailableTrackedRef.current = true;
      checkoutAnalytics.deliveryUnavailableShown({ checkout_mode: 'cart' });
    }
  }, [deliveryUnavailable]);

  const switchToPickupFromUnavailable = useCallback(() => {
    checkoutAnalytics.switchedToPickup({ checkout_mode: 'cart' });
    setFulfillment('pickup');
    setHasChosenFulfillment(true);
  }, []);

  // When delivery is unavailable and pickup exists, auto-select pickup.
  useEffect(() => {
    if (deliveryUnavailable && pickupEligible && fulfillment === 'delivery') {
      switchToPickupFromUnavailable();
    }
  }, [deliveryUnavailable, fulfillment, pickupEligible, switchToPickupFromUnavailable]);

  const chooseFulfillment = useCallback(
    (value: Fulfillment) => {
      if (value === 'delivery' && deliveryUnavailable) return;
      setFulfillment(value);
      setHasChosenFulfillment(true);
    },
    [deliveryUnavailable]
  );

  const unavailableBusinessIds = useMemo(
    () =>
      new Set(
        (preflightConfig?.groups ?? [])
          .filter((g) => g.delivery_availability?.available === false)
          .map((g) => g.business_id)
      ),
    [preflightConfig]
  );

  // Pickup timing follows the rail: card orders authorize now, MoMo pays at pickup.
  // Diaspora orders always use Stripe pay-now.
  useEffect(() => {
    if (isDiaspora) {
      setPayTiming('pay_now');
      return;
    }
    
    if (fulfillment === 'pickup') {
      setPayTiming(resolvedIsStripeRail ? 'pay_now' : 'pay_at_pickup');
    } else if (fulfillment === 'shipping') {
      setPayTiming('pay_now');
    } else if (payTiming === 'pay_at_pickup') {
      setPayTiming('pay_now');
    }
  }, [fulfillment, payTiming, resolvedIsStripeRail, isDiaspora]);

  useEffect(() => {
    setDeliveryScheduleOk(true);
    setDeliveryWindow(null);
    if (fulfillment === 'pickup') {
      setUseDifferentPhone(false);
      setOverrideNationalDigits('');
    }
  }, [fulfillment]);

  // Clear recipient when fulfillment country changes (not on initial mount)
  const prevProvisionalCountryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (someoneElseReceiving && provisionalCountry && prevProvisionalCountryRef.current !== undefined && prevProvisionalCountryRef.current !== provisionalCountry) {
      // Country actually changed (not initial mount) — reset recipient form
      setRecipient({
        name: '',
        phone: '',
        notify_whatsapp: false,
      });
    }
    prevProvisionalCountryRef.current = provisionalCountry;
  }, [provisionalCountry, someoneElseReceiving]);

  const onDwReadyChange = useCallback((ok: boolean) => {
    setDeliveryScheduleOk(ok);
  }, []);

  const onDwCommit = useCallback((w: ClientDeliveryWindowPayload | null) => {
    setDeliveryWindow(w);
  }, []);

  const businessGroups = useMemo(() => [...cart.groupedByBusiness.values()] as CartLine[][], [cart.groupedByBusiness, cart.items]);

  const feeRows = useMemo(
    () =>
      [...cart.groupedByBusiness.entries()].map(([businessId, lines]) => ({
        businessId,
        sampleInventoryItemId: lines[0].inventoryItemId,
      })),
    [cart.groupedByBusiness, cart.items]
  );

  const discountCode = usePlaceOrderDiscountCode();
  const singleBusiness = cart.groupedByBusiness.size === 1;
  const currency = cart.items[0]?.itemData.currency ?? 'XAF';

  const { byBusiness: feeByBiz, loading: feeLoading } = useCartDeliveryFees({
    rows: feeRows,
    addressId: deliveryAddressId,
    enabled: Boolean(
      fulfillmentConfirmed &&
        fulfillment === 'delivery' &&
        deliveryAddressId &&
        !addrLoading &&
        cart.items.length > 0
    ),
    requiresFastDelivery: false,
  });

  useEffect(() => {
    if (hideShopperAddressBook || !addressesForDelivery.length) {
      setAddressId((id) => (id ? '' : id));
      return;
    }
    setAddressId((id) => {
      if (id && addressesForDelivery.some((a) => a.id === id)) return id;
      return addressesForDelivery.find((a) => a.is_primary)?.id ?? addressesForDelivery[0].id;
    });
  }, [addressesForDelivery, hideShopperAddressBook]);

  useEffect(() => {
    const sel = addresses.find((a) => a.id === deliveryAddressId);
    if (!sel?.country?.trim()) {
      setPhoneDialogDefaultCountry(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const aligned = await alignCatalogAddressToCscFields({
          city: sel.city,
          state: sel.state,
          country: sel.country,
          postal_code: sel.postal_code ?? undefined,
        });
        const c = aligned.country?.trim().toUpperCase();
        if (cancelled) return;
        if (c === 'CM' || c === 'GA') setPhoneDialogDefaultCountry(c as CountryCode);
        else setPhoneDialogDefaultCountry(undefined);
      } catch {
        if (!cancelled) setPhoneDialogDefaultCountry(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deliveryAddressId, addresses]);

  useEffect(() => {
    setOverrideCountryIso(pickMobileMoneyDefaultCountry(provisionalCountry));
  }, [provisionalCountry]);

  const selectedAddress = useMemo(
    () => addressesForDelivery.find((a) => a.id === deliveryAddressId),
    [addressesForDelivery, deliveryAddressId]
  );

  const stripeDeliveryAddressIncomplete = useMemo(
    () =>
      resolvedIsStripeRail &&
      fulfillmentNeedsAddress(fulfillment) &&
      !!selectedAddress &&
      !isAddressComplete(selectedAddress),
    [fulfillment, resolvedIsStripeRail, selectedAddress]
  );

  const openCompleteSelectedAddress = useCallback(() => {
    if (!selectedAddress) return;
    openPrompt({
      address: selectedAddress,
      reason: 'checkout',
      onSaved: async () => {
        await refetchAddresses();
      },
    });
  }, [openPrompt, refetchAddresses, selectedAddress]);

  const profilePhone = meUser?.phone_number;
  const paymentPhoneRaw = useMemo(
    () => (useDifferentPhone ? overrideNationalDigits : (profilePhone ?? '')).trim(),
    [overrideNationalDigits, profilePhone, useDifferentPhone]
  );
  const paymentPhoneValidation = useMemo(
    () =>
      useDifferentPhone
        ? validateOrderPaymentPhoneForCountry(overrideCountryIso, overrideNationalDigits)
        : validateOrderPaymentPhone(paymentPhoneRaw),
    [overrideCountryIso, overrideNationalDigits, paymentPhoneRaw, useDifferentPhone]
  );
  const phoneInvalidReason = useMemo((): 'invalid' | 'unsupported' | null => {
    if (profileLoading) return null;
    if (!paymentPhoneRaw) return useDifferentPhone ? 'invalid' : null;
    if (paymentPhoneValidation.ok) return null;
    return paymentPhoneValidation.reason === 'unsupported' ? 'unsupported' : 'invalid';
  }, [paymentPhoneRaw, paymentPhoneValidation, profileLoading, useDifferentPhone]);

  const subtotal = cart.subtotal;
  const deliveryAmount = useMemo(() => {
    if (!fulfillmentConfirmed || fulfillment === 'pickup') return 0;
    if (fulfillment === 'shipping') {
      return (preflightConfig?.groups ?? []).reduce(
        (sum, group) => sum + (Number(group.delivery_fee) || 0),
        0
      );
    }
    return deliverySumFromMap(feeByBiz);
  }, [feeByBiz, fulfillment, fulfillmentConfirmed, preflightConfig]);
  const discountAmount = useMemo(() => {
    if (!singleBusiness || !discountCode.appliedCode || discountCode.percentage <= 0) return 0;
    const base = subtotal + deliveryAmount;
    return Number(((base * discountCode.percentage) / 100).toFixed(2));
  }, [deliveryAmount, discountCode.appliedCode, discountCode.percentage, singleBusiness, subtotal]);
  const grandTotal = Math.max(0, subtotal + deliveryAmount - discountAmount);

  const payAtDeliveryAllowed = useMemo(() => cart.items.every((l) => l.itemData.payOnDeliveryEnabled), [cart.items]);

  const wizardPhase = useMemo((): 'loading' | 'address' | 'checkout' => {
    if (addrLoading || profileLoading || stripeRailLoading) return 'loading';
    if (cart.items.length === 0) return 'loading';
    if (addresses.length === 0) return 'address';
    return 'checkout';
  }, [
    addrLoading,
    profileLoading,
    stripeRailLoading,
    cart.items.length,
    addresses.length,
  ]);

  const openAddAddressModal = useCallback(() => {
    setAddAddressForm({
      ...BLANK_ADDRESS_FORM,
      country: fulfillmentNeedsAddress(fulfillment) && fulfillmentCountryIso ? fulfillmentCountryIso : '',
    });
    setAddAddressModalVisible(true);
  }, [fulfillment, fulfillmentCountryIso]);

  const submitAddAddress = useCallback(async () => {
    if (
      !addAddressForm.address_line_1.trim() ||
      !addAddressForm.city.trim() ||
      !addAddressForm.state.trim() ||
      !addAddressForm.country.trim()
    ) {
      setSnack(t('client.placeOrder.addressRequiredFields', 'Please fill in address, city, state, and country.'));
      return;
    }
    setAddAddressSaving(true);
    try {
      await agentApi.addresses.create({
        address_line_1: addAddressForm.address_line_1.trim(),
        city: addAddressForm.city.trim(),
        state: addAddressForm.state.trim(),
        country: addAddressForm.country.trim(),
        postal_code: addAddressForm.postal_code.trim() || undefined,
        address_line_2: addAddressForm.address_line_2.trim() || undefined,
        address_type: 'home',
        is_primary: addresses.length === 0,
        latitude: addAddressForm.latitude,
        longitude: addAddressForm.longitude,
      });
      const list = await refetchAddresses();
      setAddAddressModalVisible(false);
      const line = addAddressForm.address_line_1.trim();
      const iso = addAddressForm.country.trim().toUpperCase();
      const created = list.find(
        (a) =>
          a.address_line_1.trim() === line && a.country.trim().toUpperCase() === iso
      );
      const inCountry = iso ? addressesInCountry(list, iso) : list;
      const pick = created ?? inCountry.find((a) => a.is_primary) ?? inCountry[0] ?? list[0];
      if (pick?.id) setAddressId(pick.id);
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('client.placeOrder.error', 'Could not place order.'));
    } finally {
      setAddAddressSaving(false);
    }
  }, [addAddressForm, addresses.length, refetchAddresses, t]);

  const onSaveProfilePhone = useCallback(
    async (phoneE164: string) => {
      try {
        await updateClientProfile({ phoneNumber: phoneE164 });
        await refetchProfile();
        setAddPhoneDialogVisible(false);
      } catch (e: unknown) {
        setSnack(e instanceof Error ? e.message : t('client.placeOrder.payment.addPhoneModal.saveError', 'Could not update your profile.'));
        throw e;
      }
    },
    [refetchProfile, t, updateClientProfile]
  );

  const onDismissAddPhoneDialog = useCallback(() => {
    if (!savingProfilePhone) setAddPhoneDialogVisible(false);
  }, [savingProfilePhone]);

  const onAddPhonePress = useCallback(() => setAddPhoneDialogVisible(true), []);

  // Diaspora orders require Stripe pay-now only
  const diasporaContext = preflightConfig?.diaspora;
  const isDiaspora = requiresStripePayNow(diasporaContext);

  /**
   * Payment rail resolution (server-authoritative):
   * - resolvedIsStripeRail comes from preflightConfig.checkout_method === 'STRIPE'
   * - Preflight considers: payer country, seller country, diaspora status, payment setup
   * - Local CM→CM = MoMo | Diaspora CA/US→CM = Stripe | CA seller = Stripe
   * - DO NOT determine rail from buyer country alone; trust preflight response
   */

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!fulfillmentConfirmed) return false;
    if (checkoutBlocker) return false;
    if (preflightLoading) return false;
    
    if (isRecipientDraftIncomplete(someoneElseReceiving, recipient)) return false;
    
    if (fulfillment === 'pickup') {
      // Pickup must be backed by a successful preflight that confirms every
      // seller group supports it — never submit unvalidated pickup payloads.
      return Boolean(preflightConfig) && pickupEligible && deliveryScheduleOk;
    }
    if (fulfillment === 'shipping') {
      return (
        Boolean(preflightConfig) &&
        shippingEligible &&
        !!deliveryAddressId &&
        !stripeDeliveryAddressIncomplete
      );
    }
    if (!deliveryAddressId || !deliveryScheduleOk || feeLoading) return false;
    if (stripeDeliveryAddressIncomplete) return false;
    if (deliveryUnavailable) return false;
    return true;
  }, [
    deliveryAddressId,
    checkoutBlocker,
    deliveryScheduleOk,
    deliveryUnavailable,
    feeLoading,
    fulfillment,
    fulfillmentConfirmed,
    pickupEligible,
    preflightConfig,
    preflightLoading,
    shippingEligible,
    stripeDeliveryAddressIncomplete,
    submitting,
    someoneElseReceiving,
    recipient,
  ]);

  const onSubmit = useCallback(async () => {
    if (submitting || !canSubmit) return;
    setSnack(null);
    const overrideValidated = validateOrderPaymentPhoneForCountry(
      overrideCountryIso,
      overrideNationalDigits
    );
    const isPickup = fulfillment === 'pickup';
    const recipientPayload = buildRecipientPayload(someoneElseReceiving, recipient);
    
    const common = {
      fulfillment_method: fulfillment,
      ...(isPickup ? {} : { delivery_address_id: deliveryAddressId }),
      ...(fulfillmentNeedsWindow(fulfillment) && deliveryWindow
        ? { delivery_window: deliveryWindow }
        : {}),
      ...(instructions.trim() ? { special_instructions: instructions.trim() } : {}),
      payment_timing: payTiming,
      ...(!resolvedIsStripeRail && useDifferentPhone && overrideValidated.ok ? { phone_number: overrideValidated.e164 } : {}),
      ...(singleBusiness && discountCode.appliedCode ? { discount_code: discountCode.appliedCode } : {}),
      ...(recipientPayload ? { recipient: recipientPayload } : {}),
    };

    const payloads = businessGroups.map((group) => ({
      ...common,
      items: group.map((line) => {
        const orderVariantId = toOrderItemVariantId(line.variantId);
        return {
          business_inventory_id: line.inventoryItemId,
          quantity: line.quantity,
          ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
        };
      }),
    }));

    const outcome = await placeCartOrders({ payloads, resolvedConfig: preflightConfig });
    if (outcome.type === 'busy') return;
    if (outcome.type === 'cancelled') {
      setSnack(t('client.placeOrder.payment.paymentCancelled', 'Payment cancelled. Your order is awaiting payment.'));
      return;
    }
    if (outcome.type === 'error') {
      if (
        outcome.code === 'MERCHANT_CLOSED' ||
        /merchant is (currently )?closed/i.test(outcome.message || '')
      ) {
        setSnack(
          outcome.message ||
            t(
              'client.placeOrder.merchantClosed',
              'This merchant is closed right now. Choose a delivery or pickup time when they are open.'
            )
        );
        return;
      }
      setSnack(outcome.message || t('client.placeOrder.error', 'Could not place order.'));
      return;
    }

    if (fulfillment === 'pickup') {
      checkoutAnalytics.orderCreatedPickup({
        checkout_mode: 'cart',
        order_count: outcome.orderNumbers.length,
      });
    }

    cart.clear();
    const momoPending =
      !resolvedIsStripeRail &&
      payTiming === 'pay_now' &&
      (outcome.type === 'pending' ||
        (outcome.type === 'success' &&
          outcome.paymentRail === 'mobile_money' &&
          !outcome.cardAuthorized));
    if (momoPending && outcome.type !== 'error' && outcome.type !== 'busy' && outcome.type !== 'cancelled') {
      const overrideValidated = validateOrderPaymentPhoneForCountry(
        overrideCountryIso,
        overrideNationalDigits
      );
      const phoneE164 =
        useDifferentPhone && overrideValidated.ok
          ? overrideValidated.e164
          : (meUser?.phone_number ?? '').trim();
      navigation.reset({
        index: 1,
        routes: [
          { name: 'ClientMainTabs' },
          {
            name: 'MobileMoneyAwaitingPayment',
            params: {
              orderIds: outcome.orderIds,
              phoneE164,
              source: 'checkout',
              orderNumbers: outcome.orderNumbers,
              fulfillment,
            },
          },
        ],
      });
      return;
    }

    const cardAuthorized = outcome.type === 'success' && !!outcome.cardAuthorized;
    const paymentCompleted = outcome.type === 'success' && !cardAuthorized;
    navigation.reset({
      index: 1,
      routes: [
        { name: 'ClientMainTabs' },
        {
          name: 'OrderPlacedSuccess',
          params: {
            orderNumbers: outcome.orderNumbers,
            paymentTiming: payTiming,
            paymentCompleted,
            cardAuthorized,
            fulfillment,
          },
        },
      ],
    });
  }, [
    deliveryAddressId,
    businessGroups,
    canSubmit,
    cart,
    submitting,
    deliveryWindow,
    discountCode.appliedCode,
    fulfillment,
    instructions,
    resolvedIsStripeRail,
    meUser?.phone_number,
    navigation,
    payTiming,
    placeCartOrders,
    preflightConfig,
    singleBusiness,
    t,
    useDifferentPhone,
    overrideCountryIso,
    overrideNationalDigits,
  ]);

  useEffect(() => {
    if (cart.items.length === 0) navigation.goBack();
  }, [cart.items.length, navigation]);

  if (wizardPhase === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.md }]}>
          {t('client.placeOrder.wizard.preparing', 'Preparing checkout…')}
        </Text>
      </View>
    );
  }

  if (wizardPhase === 'address') {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.pageBackground }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <PlaceOrderAddressStep
          form={addAddressForm}
          onChange={setAddAddressForm}
          saving={addAddressSaving}
          onContinue={() => void submitAddAddress()}
        />
        <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
          {snack}
        </Snackbar>
      </KeyboardAvoidingView>
    );
  }


  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.pageBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        {...keyboardAwareScrollProps}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
      >
        <CheckoutProgressStepper
          steps={[
            { key: 'cart', label: t('checkout.progress.cart', 'Cart') },
            { key: 'checkout', label: t('checkout.progress.checkout', 'Checkout') },
            { key: 'pay', label: t('checkout.progress.pay', 'Pay') },
          ]}
          currentStep="checkout"
        />

        <Text variant="titleMedium" style={{ marginBottom: spacing.md }}>
          {t('checkout.title', 'Checkout')}
        </Text>

        {pickupEligible || shippingEligible || shippingPartial ? (
          <PlaceOrderFulfillmentChoice
            value={fulfillment}
            onChange={chooseFulfillment}
            deliveryDisabled={deliveryUnavailable}
            deliveryDisabledReason={t(
              'client.placeOrder.deliveryUnavailable',
              'Delivery is currently unavailable.'
            )}
            pickupAvailable={pickupEligible}
            shippingAvailable={shippingEligible}
            shippingDisabled={shippingPartial}
          />
        ) : null}

        {/* Diaspora checkout banner + toggle + recipient (only when diaspora) */}
        {fulfillmentConfirmed && isDiaspora ? (
          <>
            <DiasporaCheckoutBanner
              diaspora={diasporaContext}
              someoneElseReceiving={someoneElseReceiving}
              onSomeoneElseChange={onSomeoneElseChange}
              disabled={submitting}
              style={{ marginBottom: spacing.sm }}
            />

            {/* Recipient picker (when someone-else is checked) */}
            {someoneElseReceiving ? (
              <RecipientPicker
                recipient={recipient}
                onChange={setRecipient}
                country={provisionalCountry}
                defaultCountryCode={
                  provisionalCountry && (provisionalCountry === 'CM' || provisionalCountry === 'GA')
                    ? (provisionalCountry as CountryCode)
                    : undefined
                }
                disabled={submitting}
                style={{ marginBottom: spacing.sm }}
              />
            ) : null}
          </>
        ) : null}

        {fulfillmentConfirmed &&
        fulfillmentNeedsAddress(fulfillment) &&
        sendingOrderHome &&
        !hideShopperAddressBook ? (
          <PlaceOrderDeliveryAddressBlock
            addresses={addressesForDelivery}
            selectedId={deliveryAddressId}
            onSelect={setAddressId}
            loading={addrLoading}
            error={addrError}
            onRetry={() => void refetchAddresses()}
            onAddAddress={openAddAddressModal}
            warnIncomplete={resolvedIsStripeRail}
            title={t('diaspora.recipientAddressTitle', 'Recipient delivery address')}
            helperText={t(
              'diaspora.recipientAddressHelp',
              'Enter the address where the recipient will receive this order. We share it with the delivery agent.'
            )}
            emptyMessage={t(
              'diaspora.recipientAddressEmpty',
              'Add the recipient’s delivery address in the destination country.'
            )}
            addCta={t('diaspora.addRecipientAddress', 'Add recipient address')}
          />
        ) : null}

        {businessGroups.map((lines) => (
          <View
            key={lines[0].businessId}
            style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}
          >
            <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
              {lines[0].businessName ?? t('checkout.businessOrder', 'Order from seller')}
            </Text>
            {fulfillmentConfirmed &&
            fulfillment === 'delivery' &&
            unavailableBusinessIds.has(lines[0].businessId) ? (
              <Text
                variant="bodySmall"
                style={{ color: colors.warning.main, marginBottom: spacing.xs }}
              >
                {t(
                  'checkout.groupDeliveryUnavailable',
                  'This seller cannot deliver right now.'
                )}
              </Text>
            ) : null}
            {lines.map((l) => (
              <Text key={`${l.inventoryItemId}::${l.variantId ?? ''}`} variant="bodySmall" style={{ color: colors.text.secondary }}>
                {l.itemData.name}
                {l.variantName ? ` (${l.variantName})` : ''} × {l.quantity} —{' '}
                {formatCatalogMoney(l.itemData.price * l.quantity, l.itemData.currency)}
              </Text>
            ))}
            <Text variant="bodySmall" style={{ marginTop: spacing.sm, color: colors.text.primary }}>
              {t(
                fulfillment === 'shipping'
                  ? 'client.placeOrder.summary.shippingFee'
                  : 'checkout.deliveryFee',
                fulfillment === 'shipping' ? 'Shipping' : 'Delivery'
              )}
              :{' '}
              {!fulfillmentConfirmed
                ? t('client.placeOrder.summary.chooseFulfillment', 'Choose delivery or pickup')
                : fulfillment === 'pickup'
                  ? t('checkout.pickupNoFee', 'Waived (store pickup)')
                  : fulfillment === 'shipping'
                    ? preflightLoading
                      ? '…'
                      : formatCatalogMoney(
                          Number(
                            preflightConfig?.groups?.find(
                              (g) => g.business_id === lines[0].businessId
                            )?.delivery_fee
                          ) || 0,
                          currency
                        )
                    : feeLoading
                    ? '…'
                    : formatCatalogMoney(
                        Number(feeByBiz.get(lines[0].businessId)?.deliveryFee) || 0,
                        currency
                      )}
            </Text>
          </View>
        ))}

        {fulfillmentConfirmed && fulfillment === 'shipping' ? (
          <NoticeBanner
            style={{ marginBottom: spacing.sm }}
            tone="info"
            icon="package-variant-closed"
            message={t(
              'client.placeOrder.shippingNotice',
              'The seller ships this with a carrier. Pay now to place the order.'
            )}
          />
        ) : null}

        {/* Diaspora payment notice (Stripe pay-now only) */}
        {fulfillmentConfirmed && isDiaspora ? (
          <NoticeBanner
            style={{ marginBottom: spacing.sm }}
            tone="info"
            icon="credit-card-outline"
            message={
              fulfillment === 'pickup'
                ? t(
                    'diaspora.paymentNoticePickup',
                    'Pay by card now. Funds held until the recipient picks up the order.'
                  )
                : t(
                    'diaspora.paymentNoticeDelivery',
                    'Pay by card now. Funds held until the recipient receives the order.'
                  )
            }
          />
        ) : null}

        {fulfillmentConfirmed && fulfillment === 'pickup' && !isDiaspora ? (
          <NoticeBanner
            style={{ marginBottom: spacing.sm }}
            tone="info"
            icon="store-check-outline"
            message={
              resolvedIsStripeRail
                ? t(
                    'client.placeOrder.pickupHintStripe',
                    'Pay securely by card when you place your order, then pick up at the store.'
                  )
                : t('client.placeOrder.pickupHint', 'Pay when you pick up at the store.')
            }
          />
        ) : null}

        {fulfillment === 'delivery' && deliveryUnavailable ? (
          <NoticeBanner
            style={{ marginBottom: spacing.sm }}
            tone="warning"
            icon="truck-remove-outline"
            message={
              pickupEligible
                ? t(
                    'client.placeOrder.deliveryUnavailablePickup',
                    'Delivery is currently unavailable. You can still pick up this order at the store.'
                  )
                : t(
                    'client.placeOrder.deliveryUnavailable',
                    'Delivery is currently unavailable.'
                  )
            }
            actionLabel={
              pickupEligible
                ? t('client.placeOrder.switchToPickup', 'Switch to pickup')
                : undefined
            }
            onAction={pickupEligible ? switchToPickupFromUnavailable : undefined}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillmentNeedsAddress(fulfillment) && !sendingOrderHome ? (
          <PlaceOrderDeliveryAddressBlock
            addresses={addressesForDelivery}
            selectedId={deliveryAddressId}
            onSelect={setAddressId}
            loading={addrLoading}
            error={addrError}
            onRetry={() => void refetchAddresses()}
            onAddAddress={openAddAddressModal}
            warnIncomplete={resolvedIsStripeRail}
            title={
              captureRecipientAddress
                ? t('diaspora.recipientAddressTitle', 'Recipient delivery address')
                : undefined
            }
            helperText={
              captureRecipientAddress
                ? t(
                    'diaspora.recipientAddressHelp',
                    'Enter the address where the recipient will receive this order. We share it with the delivery agent.'
                  )
                : undefined
            }
            emptyMessage={
              captureRecipientAddress
                ? t(
                    'diaspora.recipientAddressEmpty',
                    'Add the recipient’s delivery address in the destination country.'
                  )
                : undefined
            }
            addCta={
              captureRecipientAddress
                ? t('diaspora.addRecipientAddress', 'Add recipient address')
                : undefined
            }
          />
        ) : null}

        {fulfillmentConfirmed &&
        fulfillmentNeedsAddress(fulfillment) &&
        stripeDeliveryAddressIncomplete &&
        !sendingOrderHome ? (
          <NoticeBanner
            style={{ marginBottom: spacing.sm }}
            tone="warning"
            icon="map-marker-alert-outline"
            message={t(
              'checkout.incompleteAddress.banner',
              'Your delivery address is incomplete. Add city, region, and postal code to continue with card payment.'
            )}
            actionLabel={t('checkout.incompleteAddress.cta', 'Complete address')}
            onAction={openCompleteSelectedAddress}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillment === 'delivery' && selectedAddress ? (
          <PlaceOrderDeliveryWindowBlock
            countryCode={selectedAddress.country?.trim() ?? ''}
            stateCode={selectedAddress.state?.trim() ?? ''}
            enabled={Boolean(selectedAddress.country?.trim() && selectedAddress.state?.trim())}
            businessLocationId={preflightConfig?.groups?.[0]?.business_location_id}
            scheduleRequired={!!preflightConfig?.schedule_required}
            estimatedReadyAt={preflightConfig?.estimated_ready_at}
            estimatedFulfillBy={preflightConfig?.estimated_fulfill_by}
            opensAt={preflightConfig?.opens_at}
            onReadyChange={onDwReadyChange}
            onCommit={onDwCommit}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillment === 'pickup' ? (
          <PlaceOrderDeliveryWindowBlock
            countryCode={preflightConfig?.groups?.[0]?.seller_country?.trim() ?? ''}
            stateCode={preflightConfig?.groups?.[0]?.seller_state?.trim() ?? ''}
            enabled={Boolean(
              preflightConfig?.groups?.[0]?.seller_country?.trim() &&
                preflightConfig?.groups?.[0]?.seller_state?.trim()
            )}
            fulfillment="pickup"
            businessLocationId={preflightConfig?.groups?.[0]?.business_location_id}
            scheduleRequired={!!preflightConfig?.schedule_required}
            estimatedReadyAt={preflightConfig?.estimated_ready_at}
            estimatedFulfillBy={preflightConfig?.estimated_fulfill_by}
            opensAt={preflightConfig?.opens_at}
            onReadyChange={onDwReadyChange}
            onCommit={onDwCommit}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillment === 'delivery' && payAtDeliveryAllowed && !isDiaspora ? (
          <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
              {t('client.placeOrder.paymentTiming', 'Payment')}
            </Text>
            <SegmentedButtons
              value={payTiming === 'pay_at_delivery' ? 'pad' : 'now'}
              onValueChange={(v) => setPayTiming(v === 'pad' ? 'pay_at_delivery' : 'pay_now')}
              buttons={[
                { value: 'now', label: t('client.placeOrder.payNow', 'Pay now') },
                { value: 'pad', label: t('client.placeOrder.payAtDelivery', 'Pay at delivery') },
              ]}
            />
          </View>
        ) : null}

        {/* Diaspora: show indicative FX estimate when available */}
        {fulfillmentConfirmed && isDiaspora && diasporaContext?.payer_charge_estimate ? (
          <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <PayerChargeSummary diaspora={diasporaContext} locale={t('common.locale', 'en')} />
          </View>
        ) : null}

        {singleBusiness ? (
          couponExpanded || discountCode.appliedCode ? (
            <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
              <Text variant="titleSmall">{t('client.placeOrder.discountCode.label', 'Discount code')}</Text>
              <TextInput mode="outlined" value={discountCode.draft} onChangeText={discountCode.setDraft} style={{ marginTop: spacing.sm }} />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                <Button mode="contained-tonal" onPress={() => void discountCode.apply()} loading={discountCode.loading}>
                  {t('client.placeOrder.discountCode.apply', 'Apply')}
                </Button>
                {discountCode.appliedCode ? (
                  <Button mode="text" onPress={discountCode.clear}>
                    {t('client.placeOrder.discountCode.clear', 'Clear')}
                  </Button>
                ) : null}
              </View>
              {discountCode.error ? (
                <Text style={{ color: colors.error.main, marginTop: spacing.xs }}>{discountCode.error}</Text>
              ) : null}
            </View>
          ) : (
            <View style={{ alignItems: 'flex-start' }}>
              <Button
                mode="text"
                compact
                icon="ticket-percent-outline"
                onPress={() => setCouponExpanded(true)}
              >
                {t('client.placeOrder.discountCode.haveCoupon', 'Have a coupon?')}
              </Button>
            </View>
          )
        ) : null}

        <CartCheckoutSummaryCard
          currency={currency}
          subtotal={subtotal}
          deliveryLabel={
            !fulfillmentConfirmed
              ? t('client.placeOrder.summary.chooseFulfillment', 'Choose delivery or pickup')
              : fulfillment === 'pickup'
                ? t('checkout.pickupNoFee', 'Waived (store pickup)')
                : formatCatalogMoney(deliveryAmount, currency)
          }
          feeTitle={
            fulfillment === 'shipping'
              ? t('client.placeOrder.summary.shippingFee', 'Shipping fee')
              : t('checkout.deliveryFee', 'Delivery')
          }
          deliveryMuted={fulfillmentConfirmed && fulfillment === 'pickup'}
          deliveryPending={!fulfillmentConfirmed}
          discountAmount={discountAmount}
          showTaxAtCheckout={preflightConfig?.tax_notice === 'calculated_at_checkout'}
          grandTotal={grandTotal}
        />

        {/* Payment method (country-locked) - driven by preflight, not client country */}
        {fulfillmentConfirmed && preflightConfig ? (
          <>
            <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
              <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
                {t('checkout.paymentMethod', 'Payment method')}
              </Text>
              <PaymentMethodLockedRow
                method={resolvedIsStripeRail ? 'stripe' : 'mobile_money'}
                countryIso={
                  // Country label logic (for display only):
                  // - Diaspora: no country label (payer is abroad)
                  // - Stripe: no country label (card payment without country suffix)
                  // - Local MoMo: show buyer/market/delivery country (NOT seller country)
                  isDiaspora
                    ? undefined
                    : resolvedIsStripeRail
                      ? undefined
                      : resolveMoMoDisplayCountryIso({
                          selectedAddressCountry: selectedAddress?.country,
                          preflightDeliveryCountry: preflightConfig.delivery_country,
                          userCountry: meUser?.country,
                          userPhone: meUser?.phone_number,
                        })
                }
                locked
              />
            </View>

            {/* Hide payment phone on diaspora (Stripe only) + show locked MoMo phone for local */}
            {!isDiaspora && !resolvedIsStripeRail ? (
              <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
                <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
                  {t('checkout.yourMoMoNumber', 'Your MoMo number')}
                </Text>
                <PlaceOrderPaymentBlock
                  isStripeRail={false}
                  profileLoading={profileLoading}
                  profilePhone={profilePhone}
                  payTiming={payTiming}
                  fulfillment={fulfillment}
                  useDifferentPhone={useDifferentPhone}
                  onToggleDifferentPhone={setUseDifferentPhone}
                  overrideCountryIso={overrideCountryIso}
                  overrideNationalDigits={overrideNationalDigits}
                  onOverrideCountryIsoChange={setOverrideCountryIso}
                  onOverrideNationalDigitsChange={setOverrideNationalDigits}
                  phoneInvalidReason={phoneInvalidReason}
                  onAddPhonePress={onAddPhonePress}
                />
                <Text style={[typography.caption, { color: colors.text.secondary, marginTop: spacing.xs }]}>
                  {t('checkout.momoPhoneHelper', 'Must match your MoMo number')}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
          <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
            {t('client.placeOrder.notes', 'Special instructions (optional)')}
          </Text>
          <TextInput mode="outlined" multiline value={instructions} onChangeText={setInstructions} numberOfLines={3} />
        </View>

        {checkoutBlocker && (
          <NoticeBanner
            tone="error"
            icon="alert-circle-outline"
            message={checkoutBlocker.message}
            style={{ marginTop: spacing.md }}
          />
        )}

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            mode="contained"
            icon={resolvedIsStripeRail ? 'credit-card-outline' : 'cellphone'}
            onPress={() => void onSubmit()}
            loading={submitting}
            disabled={!canSubmit || submitting}
            contentStyle={{ height: 52 }}
          >
            {resolvedIsStripeRail
              ? t('checkout.payNow', 'Pay now')
              : t('checkout.payWithMoMo', 'Pay with MoMo')}
          </Button>
          {isRecipientDraftIncomplete(someoneElseReceiving, recipient) ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {t('diaspora.selectRecipientToPay', 'Select a recipient before paying')}
            </Text>
          ) : captureRecipientAddress && !deliveryAddressId ? (
            <Text variant="bodySmall" style={{ color: colors.text.secondary, textAlign: 'center' }}>
              {t('diaspora.selectRecipientAddressToPay', 'Add the recipient’s delivery address before paying')}
            </Text>
          ) : null}

          {!submitting && canSubmit ? (
            <View style={[styles.trustBadge, { backgroundColor: colors.primaryTint, borderRadius: borderRadius.sm }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primary.main} />
              <Text style={[typography.caption, { color: colors.text.secondary }]}>
                {t('checkout.heldUntilAccept', 'Held until store accepts')}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={5000}>
        {snack}
      </Snackbar>

      {CompleteAddressPromptEl}

      <AppModal
        visible={addAddressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !addAddressSaving && setAddAddressModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderColor: colors.divider }]}>
            <ScrollView {...keyboardAwareScrollProps} showsVerticalScrollIndicator={false}>
              <Text variant="titleLarge" style={{ marginBottom: spacing.md }}>
                {captureRecipientAddress
                  ? t('diaspora.addRecipientAddress', 'Add recipient address')
                  : t('client.placeOrder.addAddressModalTitle', 'Add delivery address')}
              </Text>
              <AddressCapture
                value={addAddressForm}
                onChange={setAddAddressForm}
                disabled={addAddressSaving}
                context="delivery"
                disableCountry={Boolean(fulfillmentCountryIso && fulfillmentNeedsAddress(fulfillment))}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button mode="outlined" style={{ flex: 1 }} onPress={() => !addAddressSaving && setAddAddressModalVisible(false)} disabled={addAddressSaving}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button mode="contained" style={{ flex: 1 }} onPress={() => void submitAddAddress()} loading={addAddressSaving} disabled={addAddressSaving}>
                  {t('common.save', 'Save')}
                </Button>
              </View>
            </ScrollView>
          </View>
        </View>
      </AppModal>

      <AddPaymentPhoneDialog
        visible={addPhoneDialogVisible}
        saving={savingProfilePhone}
        onDismiss={onDismissAddPhoneDialog}
        onSave={onSaveProfilePhone}
        defaultCountryIso={phoneDialogDefaultCountry}
      />

      <ActionLoadingDialog visible={submitting} action="checkout_pay" />
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  block: { padding: 16, borderWidth: 1, marginBottom: 12 },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
  modalBox: { maxHeight: '88%', padding: 20, borderWidth: 1 },
});
