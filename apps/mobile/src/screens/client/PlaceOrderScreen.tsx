import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppModal } from '../../components/common/AppModal';
import { CheckoutStickyActionBar } from '../../components/common/CheckoutStickyActionBar';
import type { CheckoutStickyBreakdownLine } from '../../components/common/CheckoutStickyActionBar';
import { KitchenClosedStickyPanel } from '../../components/checkout/KitchenClosedStickyPanel';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Button,
  IconButton,
  SegmentedButtons,
  Snackbar,
  Text,
} from 'react-native-paper';
import { agentApi } from '../../services/agentApi';
import { checkoutAnalytics } from '../../services/checkoutAnalytics';
import { nextDeliveryUnavailableLatch } from '../../utils/deliveryAvailabilityLatch';
import { useTheme } from '../../contexts/ThemeContext';
import { isAfricanMarketCountry } from '../../constants/marketCountries';
import { PlaceOrderDeliveryWindowBlock } from '../../components/browse/PlaceOrderDeliveryWindowBlock';
import { PlaceOrderPaymentBlock } from '../../components/browse/PlaceOrderPaymentBlock';
import { VariantOptionPicker } from '../../components/browse/VariantOptionPicker';
import { AddPaymentPhoneDialog } from '../../components/dialogs/AddPaymentPhoneDialog';
import { ActionLoadingDialog } from '../../components/feedback/ActionLoadingDialog';
import { PlaceOrderSummaryCard } from '../../components/browse/PlaceOrderSummaryCard';
import { appliedPurchaseCredit } from '../../utils/purchaseCredits';
import { PlaceOrderAddressStep } from '../../components/place-order/PlaceOrderAddressStep';
import { PlaceOrderDeliveryAddressBlock } from '../../components/place-order/PlaceOrderDeliveryAddressBlock';
import {
  PlaceOrderFulfillmentChoice,
  type OrderFulfillment,
} from '../../components/place-order/PlaceOrderFulfillmentChoice';
import { PlaceOrderSpecialInstructions } from '../../components/place-order/PlaceOrderSpecialInstructions';
import { AddressCapture } from '../../components/forms/AddressCapture';
import type { DeliveryAddressFormValue } from '../../components/forms/DeliveryAddressForm';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { DiasporaCheckoutBanner } from '../../components/checkout/DiasporaCheckoutBanner';
import { RecipientPicker } from '../../components/checkout/RecipientPicker';
import { PayerChargeSummary } from '../../components/checkout/PayerChargeSummary';
import { CheckoutProgressStepper } from '../../components/checkout/CheckoutProgressStepper';
import { PaymentMethodLockedRow } from '../../components/checkout/PaymentMethodLockedRow';
import { ReservationDepositExplainer } from '../../components/checkout/ReservationDepositExplainer';
import { useClientAddresses } from '../../hooks/useClientAddresses';
import { resolveDepositAmount, isMoMoDepositCheckoutPath } from '../../types/deposit';
import { useClientProfileForPlaceOrder } from '../../hooks/useClientProfileForPlaceOrder';
import { useCheckoutOrchestrator } from '../../hooks/useCheckoutOrchestrator';
import { useCompleteAddressPrompt } from '../../hooks/useCompleteAddressPrompt';
import { useInventoryItemDetail } from '../../hooks/useInventoryItemDetail';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { usePlaceOrderDeliveryFee } from '../../hooks/usePlaceOrderDeliveryFee';
import { useResolvedCheckout } from '../../hooks/useResolvedCheckout';
import { usePlaceOrderDiscountCode } from '../../hooks/usePlaceOrderDiscountCode';
import useUpdateClientProfile from '../../hooks/useUpdateClientProfile';
import type { ClientRootStackParamList, PlaceOrderParams } from '../../navigation/types';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import type { ClientDeliveryWindowPayload } from '../../types/deliveryWindow';
import type { CreateOrderPayload, RecipientContact } from '../../types/clientOrder';
import type { SavedRecipient } from '../../types/recipient';
import {
  catalogOrderedImages,
  formatCatalogMoney,
} from '../../utils/catalogInventoryDisplay';
import { pickMobileMoneyDefaultCountry, validateOrderPaymentPhone, validateOrderPaymentPhoneForCountry } from '../../utils/placeOrderPhoneValidation';
import { alignCatalogAddressToCscFields } from '../../utils/addressRegionMatch';
import { checkoutPreflightBlocker } from '../../utils/checkoutPreflightBlocker';
import { isAddressComplete } from '../../utils/addressCompleteness';
import { resolveMoMoDisplayCountryIso } from '../../utils/momoCountryDisplay';
import {
  cartShippingAvailability,
  fulfillmentNeedsAddress,
  fulfillmentNeedsWindow,
} from '../../utils/fulfillmentMethod';
import { isFoodCatalogItem } from '../../utils/foodAvailability';
import {
  effectiveVariantUnitPrice,
  orderedVariantImages,
  unitPriceWithListingDeal,
} from '../../types/business/itemVariant';
import {
  SHOPPER_BASE_VARIANT_ID,
  isShopperBaseVariantId,
  shopperVariantOptions,
  toOrderItemVariantId,
} from '../../utils/shopperVariantSelection';
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

const BLANK_ADDRESS_FORM: DeliveryAddressFormValue = {
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

type Fulfillment = OrderFulfillment;
type PayTiming = 'pay_now' | 'pay_at_delivery' | 'pay_at_pickup';

function unitPrice(item: CatalogInventoryItem, variantId: string | null): number {
  const dbVariantId =
    variantId && !isShopperBaseVariantId(variantId) ? variantId : null;
  const variant = item.item.item_variants?.find((candidate) => candidate.id === dbVariantId);
  const override = item.variant_price_overrides?.find(
    (candidate) => candidate.item_variant_id === dbVariantId
  );
  const base = effectiveVariantUnitPrice(variant, item.selling_price, override);
  return unitPriceWithListingDeal(
    base,
    item.selling_price,
    item.hasActiveDeal,
    item.original_price,
    item.discounted_price
  ).unit;
}

export default function PlaceOrderScreen() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const keyboardVerticalOffset = useKeyboardVerticalOffset();
  const navigation = useNavigation<NativeStackNavigationProp<ClientRootStackParamList>>();
  const route = useRoute<RouteProp<{ PlaceOrder: PlaceOrderParams }, 'PlaceOrder'>>();
  const { inventoryItemId, variantId: initialVariantId } = route.params;

  const { item, loading: itemLoading, error: itemError } = useInventoryItemDetail(inventoryItemId, {
    withAuth: true,
  });
  const { addresses, loading: addrLoading, error: addrError, refetch: refetchAddresses } = useClientAddresses();
  const { user: meUser, loading: profileLoading, refetch: refetchProfile } = useClientProfileForPlaceOrder();
  const { updateClientProfile, loading: savingProfilePhone } = useUpdateClientProfile();
  const { isStripeRail, loading: stripeRailLoading } = useIsStripeRail();
  const { placeSingleOrder, submitting } = useCheckoutOrchestrator();
  const { openPrompt, Prompt: CompleteAddressPromptEl } = useCompleteAddressPrompt();

  const sellerCountry = item?.business_location?.address?.country?.trim().toUpperCase();
  const pickupEnabled = Boolean(item?.item.pay_at_pickup_enabled);
  const shippingEnabled = Boolean(item?.item.shipping_enabled);
  const payAtDeliveryEnabled = Boolean(item?.item.pay_on_delivery_enabled);

  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState('');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  // Pickup is the default when available; confirmed immediately.
  const [hasChosenFulfillment, setHasChosenFulfillment] = useState(true);
  // Default to pay_at_delivery (safe default when momo_pay_now_delivery_enabled may be false)
  const [payTiming, setPayTiming] = useState<PayTiming>('pay_at_delivery');
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
  
  // Diaspora: recipient is always required once preflight confirms diaspora.
  const [recipient, setRecipient] = useState<Partial<RecipientContact>>({
    name: '',
    phone: '',
    notify_whatsapp: false,
  });
  const [savedRecipientId, setSavedRecipientId] = useState<string | null>(null);
  /** When true, do not auto-pick a delivery address (recipient just changed). */
  const [suppressAddressAutoSelect, setSuppressAddressAutoSelect] = useState(false);
  
  const fulfillmentConfirmed =
    !(pickupEnabled || shippingEnabled) || hasChosenFulfillment;

  const fulfillmentCountryIso = (sellerCountry ?? '').trim().toUpperCase();
  const payerCountryIso = normalizeCountryIso(
    addresses.find((a) => a.is_primary)?.country ?? addresses[0]?.country
  );
  const sendingOrderHome = Boolean(
    fulfillmentCountryIso && payerCountryIso && payerCountryIso !== fulfillmentCountryIso
  );
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

  const basePreflightRequest = useMemo(() => {
    if (!item || !fulfillmentConfirmed) return null;
    const orderVariantId = toOrderItemVariantId(variantId);
    const line = {
      business_inventory_id: item.id,
      quantity,
      ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
    };
    if (deliveryAddressId && fulfillmentNeedsAddress(fulfillment)) {
      return {
        items: [line],
        fulfillment_method: fulfillment,
        delivery_address_id: deliveryAddressId,
      };
    }
    if (fulfillment === 'pickup' || sellerCountry) {
      return {
        items: [line],
        fulfillment_method: fulfillment,
        ...(sellerCountry ? { provisional_country: sellerCountry } : {}),
      };
    }
    return null;
  }, [
    deliveryAddressId,
    fulfillment,
    fulfillmentConfirmed,
    item,
    quantity,
    sellerCountry,
    variantId,
  ]);

  const preflightRequest = useMemo(() => {
    if (!basePreflightRequest) return null;
    return { ...basePreflightRequest, payment_timing: payTiming };
  }, [basePreflightRequest, payTiming]);

  const { config: preflightConfig, loading: preflightLoading } = useResolvedCheckout({
    request: preflightRequest,
    enabled: Boolean(item && fulfillmentConfirmed),
  });

  const checkoutBlocker = useMemo(
    () => checkoutPreflightBlocker(preflightConfig, preflightLoading),
    [preflightConfig, preflightLoading]
  );

  const shippingEligible = useMemo(
    () => cartShippingAvailability(preflightConfig?.groups ?? []).eligible,
    [preflightConfig]
  );

  // When a resolved config is available, prefer its checkout_method over the
  // buyer-rail useIsStripeRail hook. Falls back to legacy hook while preflight loads.
  const resolvedIsStripeRail = preflightConfig
    ? preflightConfig.checkout_method === 'STRIPE'
    : isStripeRail;

  // Sticky latch: preflight only returns delivery_availability for delivery
  // fulfillment. Keep the disabled state after auto-switching to pickup so the
  // Delivery card stays grayed out with a clear reason.
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
      checkoutAnalytics.deliveryUnavailableShown({ checkout_mode: 'single' });
    }
  }, [deliveryUnavailable]);

  const switchToPickupFromUnavailable = useCallback(() => {
    checkoutAnalytics.switchedToPickup({ checkout_mode: 'single' });
    setFulfillment('pickup');
    setHasChosenFulfillment(true);
  }, []);

  // When delivery is unavailable and pickup exists, auto-select pickup.
  useEffect(() => {
    if (deliveryUnavailable && pickupEnabled && fulfillment === 'delivery') {
      switchToPickupFromUnavailable();
    }
  }, [deliveryUnavailable, fulfillment, pickupEnabled, switchToPickupFromUnavailable]);

  const chooseFulfillment = useCallback(
    (value: Fulfillment) => {
      if (value === 'delivery' && deliveryUnavailable) return;
      setFulfillment(value);
      setHasChosenFulfillment(true);
    },
    [deliveryUnavailable]
  );

  // If pickup isn't offered for this item, fall back to delivery/shipping once.
  useEffect(() => {
    if (!item) return;
    if (fulfillment === 'pickup' && !pickupEnabled) {
      setFulfillment(shippingEnabled ? 'shipping' : 'delivery');
    }
  }, [item, fulfillment, pickupEnabled, shippingEnabled]);

  const onDwReadyChange = useCallback((ok: boolean) => {
    setDeliveryScheduleOk(ok);
  }, []);

  const onDwCommit = useCallback((w: ClientDeliveryWindowPayload | null) => {
    setDeliveryWindow(w);
  }, []);

  // Switching fulfillment mode invalidates any previously selected schedule,
  // since delivery and pickup fetch slots for different locations/hours.
  useEffect(() => {
    setDeliveryScheduleOk(true);
    setDeliveryWindow(null);
    if (fulfillment === 'pickup') {
      setUseDifferentPhone(false);
      setOverrideNationalDigits('');
    }
  }, [fulfillment]);

  const defaultVariantLabel = t('orders.variant.defaultOption', 'Default');

  const dbVariants = useMemo(() => {
    const raw = item?.item.item_variants ?? [];
    return [...raw]
      .filter((v) => v.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [item]);

  const parentImageUrl = useMemo(() => {
    if (!item) return null;
    return catalogOrderedImages(item)[0]?.image_url ?? null;
  }, [item]);

  const variants = useMemo(
    () =>
      shopperVariantOptions({
        defaultLabel: defaultVariantLabel,
        variants: dbVariants,
        parentImageUrl,
      }),
    [defaultVariantLabel, dbVariants, parentImageUrl]
  );

  const variantRowKey = useMemo(() => variants.map((v) => v.id).join('|'), [variants]);

  useEffect(() => {
    if (!item) return;
    if (dbVariants.length === 0) {
      setVariantId(null);
      return;
    }
    const preferred = initialVariantId
      ? isShopperBaseVariantId(initialVariantId)
        ? SHOPPER_BASE_VARIANT_ID
        : initialVariantId
      : null;
    if (preferred && variants.some((v) => v.id === preferred)) {
      setVariantId(preferred);
      return;
    }
    setVariantId((prev) =>
      prev && variants.some((v) => v.id === prev) ? prev : null
    );
  }, [item, variantRowKey, variants, dbVariants.length, initialVariantId]);

  useEffect(() => {
    if (!item) return;
    const minQ = Math.max(1, item.item.min_order_quantity ?? 1);
    const ignoresStock = isFoodCatalogItem(item);
    const maxQ = ignoresStock
      ? Math.max(minQ, item.item.max_order_quantity ?? 99)
      : Math.max(
          minQ,
          Math.min(
            item.item.max_order_quantity ?? item.computed_available_quantity,
            item.computed_available_quantity
          )
        );
    setQuantity((q) => Math.min(Math.max(q, minQ), maxQ));
  }, [item]);

  const minQ = item ? Math.max(1, item.item.min_order_quantity ?? 1) : 1;
  const maxQ = item
    ? isFoodCatalogItem(item)
      ? Math.max(minQ, item.item.max_order_quantity ?? 99)
      : Math.max(
          minQ,
          Math.min(
            item.item.max_order_quantity ?? item.computed_available_quantity,
            item.computed_available_quantity
          )
        )
    : 1;

  const wizardPhase = useMemo((): 'loading' | 'address' | 'checkout' => {
    if (itemLoading || !item) return 'loading';
    if (addrLoading || profileLoading || stripeRailLoading) return 'loading';
    if (addresses.length === 0 && !pickupEnabled) return 'address';
    return 'checkout';
  }, [
    itemLoading,
    item,
    addrLoading,
    profileLoading,
    stripeRailLoading,
    addresses.length,
    pickupEnabled,
  ]);

  // Diaspora orders require Stripe pay-now only; someone else always receives.
  const diasporaContext = preflightConfig?.diaspora;
  const isDiaspora = requiresStripePayNow(diasporaContext);
  const someoneElseReceiving = isDiaspora;
  const captureRecipientAddress = needsRecipientDeliveryAddress(
    someoneElseReceiving,
    fulfillmentNeedsAddress(fulfillment)
  );
  const hideShopperAddressBook =
    sendingOrderHome &&
    !someoneElseReceiving &&
    fulfillmentNeedsAddress(fulfillment);

  const selectDeliveryAddress = useCallback(
    (id: string) => {
      setSuppressAddressAutoSelect(false);
      setAddressId(id);
      if (!savedRecipientId) return;
      void agentApi.recipients
        .update(savedRecipientId, { address_id: id })
        .catch(() => {
          setSnack(
            t('diaspora.linkAddressFailed', 'Could not save this address for the recipient.')
          );
        });
    },
    [savedRecipientId, t]
  );

  const onSavedRecipientSelection = useCallback(
    (saved: SavedRecipient | null) => {
      setSavedRecipientId(saved?.id ?? null);
      const linkedId = saved?.address_id ?? null;
      if (linkedId && addressesForDelivery.some((a) => a.id === linkedId)) {
        setSuppressAddressAutoSelect(false);
        setAddressId(linkedId);
        return;
      }
      setSuppressAddressAutoSelect(true);
      setAddressId('');
    },
    [addressesForDelivery]
  );

  const recipientAddressTitle = useMemo(() => {
    const name = recipient.name?.trim();
    if (name) {
      return t('diaspora.recipientAddressTitleFor', 'Delivery address for {{name}}', {
        name,
      });
    }
    return t('diaspora.recipientAddressTitle', 'Recipient delivery address');
  }, [recipient.name, t]);

  // Clear recipient when fulfillment country changes (not on initial mount)
  const prevSellerCountryRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (
      someoneElseReceiving &&
      sellerCountry &&
      prevSellerCountryRef.current !== undefined &&
      prevSellerCountryRef.current !== sellerCountry
    ) {
      setRecipient({
        name: '',
        phone: '',
        notify_whatsapp: false,
      });
      setSavedRecipientId(null);
      setSuppressAddressAutoSelect(true);
      setAddressId('');
    }
    prevSellerCountryRef.current = sellerCountry;
  }, [sellerCountry, someoneElseReceiving]);

  useEffect(() => {
    if (hideShopperAddressBook || !addressesForDelivery.length) {
      setAddressId((id) => (id ? '' : id));
      return;
    }
    if (suppressAddressAutoSelect) return;
    setAddressId((id) => {
      if (id && addressesForDelivery.some((a) => a.id === id)) return id;
      return addressesForDelivery.find((a) => a.is_primary)?.id ?? addressesForDelivery[0].id;
    });
  }, [addressesForDelivery, hideShopperAddressBook, suppressAddressAutoSelect]);

  // Same gate as CartCheckout — only when preflight marks pay-after eligible.
  const isCookedFoodMoMoPayAfter =
    preflightConfig?.pay_after_merchant_confirm_eligible === true;

  useEffect(() => {
    // Diaspora orders always use Stripe pay-now
    if (isDiaspora) {
      setPayTiming('pay_now');
      return;
    }

    const momoPayNowEnabled = preflightConfig?.momo_pay_now_delivery_enabled ?? false;

    if (fulfillment === 'pickup') {
      setPayTiming(resolvedIsStripeRail ? 'pay_now' : 'pay_at_pickup');
    } else if (fulfillment === 'shipping') {
      setPayTiming('pay_now');
    } else if (fulfillment === 'delivery') {
      if (resolvedIsStripeRail) {
        setPayTiming('pay_now');
      } else if (isCookedFoodMoMoPayAfter) {
        // Pay after kitchen confirm; store pay_now so agents get Complete+PIN.
        setPayTiming('pay_now');
      } else if (momoPayNowEnabled) {
        if (payTiming === 'pay_at_pickup') {
          setPayTiming('pay_now');
        }
      } else {
        setPayTiming('pay_at_delivery');
      }
    }
  }, [
    fulfillment,
    resolvedIsStripeRail,
    isDiaspora,
    preflightConfig?.momo_pay_now_delivery_enabled,
    payTiming,
    isCookedFoodMoMoPayAfter,
  ]);

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
        const list = await refetchAddresses();
        if (list?.some((a) => a.id === selectedAddress.id)) {
          setAddressId(selectedAddress.id);
        }
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
    if (!paymentPhoneRaw) {
      return useDifferentPhone ? 'invalid' : null;
    }
    if (paymentPhoneValidation.ok) return null;
    return paymentPhoneValidation.reason === 'unsupported' ? 'unsupported' : 'invalid';
  }, [paymentPhoneRaw, paymentPhoneValidation, profileLoading, useDifferentPhone]);

  const onAddPhonePress = useCallback(() => {
    setAddPhoneDialogVisible(true);
  }, []);

  const onDismissAddPhoneDialog = useCallback(() => {
    if (!savingProfilePhone) setAddPhoneDialogVisible(false);
  }, [savingProfilePhone]);

  const onSaveProfilePhone = useCallback(
    async (phoneE164: string) => {
      try {
        await updateClientProfile({ phoneNumber: phoneE164 });
        await refetchProfile();
        setAddPhoneDialogVisible(false);
        setSnack(
          t(
            'client.placeOrder.payment.addPhoneModal.saveSuccess',
            'Phone number saved. You can continue placing your order.'
          )
        );
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t(
                'client.placeOrder.payment.addPhoneModal.saveError',
                'Could not update your profile. Please try again.'
              )
        );
        throw e;
      }
    },
    [refetchProfile, t, updateClientProfile]
  );

  const openAddAddressModal = useCallback(() => {
    const lockedCountry =
      fulfillmentNeedsAddress(fulfillment) && fulfillmentCountryIso
        ? fulfillmentCountryIso
        : '';
    if (!item) {
      setAddAddressForm({ ...BLANK_ADDRESS_FORM, country: lockedCountry });
      setAddAddressModalVisible(true);
      return;
    }
    void (async () => {
      try {
        const addr = item.business_location?.address;
        if (!addr) {
          setAddAddressForm({ ...BLANK_ADDRESS_FORM, country: lockedCountry });
          return;
        }
        const aligned = await alignCatalogAddressToCscFields({
          city: addr.city,
          state: addr.state,
          country: addr.country,
          postal_code: addr.postal_code,
        });
        const country = lockedCountry || aligned.country;
        const sameCountry =
          (aligned.country ?? '').trim().toUpperCase() === (country ?? '').trim().toUpperCase();
        const hidePostal = isAfricanMarketCountry(country);
        setAddAddressForm({
          address_line_1: '',
          address_line_2: '',
          city: sameCountry ? aligned.city : '',
          state: sameCountry ? aligned.state : '',
          country,
          postal_code: sameCountry && !hidePostal ? (addr.postal_code?.trim() ?? '') : '',
        });
      } catch {
        setAddAddressForm({ ...BLANK_ADDRESS_FORM, country: lockedCountry });
      } finally {
        setAddAddressModalVisible(true);
      }
    })();
  }, [fulfillment, fulfillmentCountryIso, item]);

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
      if (pick?.id) {
        setSuppressAddressAutoSelect(false);
        setAddressId(pick.id);
        if (savedRecipientId) {
          void agentApi.recipients
            .update(savedRecipientId, { address_id: pick.id })
            .catch(() => {
              setSnack(
                t('diaspora.linkAddressFailed', 'Could not save this address for the recipient.')
              );
            });
        }
      }
    } catch (e: unknown) {
      setSnack(e instanceof Error ? e.message : t('client.placeOrder.error', 'Could not place order.'));
    } finally {
      setAddAddressSaving(false);
    }
  }, [addAddressForm, addresses.length, refetchAddresses, savedRecipientId, t]);

  const deliveryFeeState = usePlaceOrderDeliveryFee({
    itemId: item?.id ?? '',
    addressId: deliveryAddressId,
    enabled: Boolean(
      item &&
        fulfillmentConfirmed &&
        fulfillment === 'delivery' &&
        deliveryAddressId &&
        !addrLoading
    ),
    requiresFastDelivery: false,
  });

  const discountCode = usePlaceOrderDiscountCode();

  const currency = item?.item.currency ?? 'XAF';
  const unit = item ? unitPrice(item, variantId) : 0;
  const lineSubtotal = unit * quantity;

  const unitMoney = useMemo(
    () => (item ? formatCatalogMoney(unit, currency) : ''),
    [currency, item, unit]
  );

  const deliveryFullBefore = useMemo(() => {
    const d = deliveryFeeState.data;
    if (!d) return 0;
    return (Number(d.baseDeliveryFeeBeforeDiscount) || 0) + (Number(d.perKmDeliveryFee) || 0);
  }, [deliveryFeeState.data]);

  const deliveryAmount = useMemo(() => {
    if (fulfillment === 'pickup') return 0;
    if (fulfillment === 'shipping') {
      return Number(preflightConfig?.groups?.[0]?.delivery_fee) || 0;
    }
    return deliveryFeeState.data?.deliveryFee ?? 0;
  }, [deliveryFeeState.data, fulfillment, preflightConfig]);

  const pickupLocations = useMemo(() => {
    const loc = item?.business_location;
    if (!loc) return [];
    const addr = loc.address;
    const address = addr
      ? [addr.address_line_1, addr.city, addr.state, addr.country].filter(Boolean).join(', ')
      : undefined;
    return [{ name: loc.name, address }];
  }, [item]);

  const discountAmount = useMemo(() => {
    if (!discountCode.appliedCode || discountCode.percentage <= 0) return 0;
    const base = lineSubtotal + deliveryAmount;
    return Number(((base * discountCode.percentage) / 100).toFixed(2));
  }, [deliveryAmount, discountCode.appliedCode, discountCode.percentage, lineSubtotal]);

  const grandTotal = Math.max(0, lineSubtotal + deliveryAmount - discountAmount);

  const momoPayNowDeliveryEnabled = preflightConfig?.momo_pay_now_delivery_enabled ?? false;

  // Deposit UI only when the server quotes a deposit. Cooked-food orders never
  // take a reservation deposit.
  const isCookedFoodOrder = item != null && isFoodCatalogItem(item);

  const isDepositPath = useMemo(() => {
    return isMoMoDepositCheckoutPath({
      isDiaspora,
      isStripeRail: resolvedIsStripeRail,
      depositAmount: preflightConfig?.deposit_amount,
      depositRequired: preflightConfig?.deposit_required,
      groupDepositAmount: preflightConfig?.groups?.[0]?.deposit_amount,
      groupDepositRequired: preflightConfig?.groups?.[0]?.deposit_required,
      preflightLoaded: preflightConfig != null,
      momoPayNowDeliveryEnabled,
      payTiming,
      cookedFoodOrder: isCookedFoodOrder || isCookedFoodMoMoPayAfter,
    });
  }, [
    isDiaspora,
    resolvedIsStripeRail,
    preflightConfig,
    payTiming,
    momoPayNowDeliveryEnabled,
    isCookedFoodOrder,
    isCookedFoodMoMoPayAfter,
  ]);

  // Deposit calculation: prefer server deposit_amount, fallback to calculation.
  const depositAmount = useMemo(() => {
    if (!isDepositPath) return null;
    const serverDeposit =
      preflightConfig?.deposit_amount ??
      preflightConfig?.groups?.[0]?.deposit_amount;
    return resolveDepositAmount(grandTotal, serverDeposit);
  }, [
    isDepositPath,
    grandTotal,
    preflightConfig?.deposit_amount,
    preflightConfig?.groups,
  ]);

  const amountDueAfterDeposit = useMemo(() => {
    if (depositAmount == null || depositAmount <= 0) return null;
    const serverDue =
      preflightConfig?.amount_due ??
      preflightConfig?.groups?.[0]?.amount_due;
    if (serverDue != null) return Math.max(0, Number(serverDue));
    return Math.max(0, grandTotal - depositAmount);
  }, [
    depositAmount,
    grandTotal,
    preflightConfig?.amount_due,
    preflightConfig?.groups,
  ]);

  const depositIsFloor = useMemo(() => {
    if (!depositAmount) return false;
    const DEPOSIT_FLOOR = 150;
    return depositAmount === DEPOSIT_FLOOR;
  }, [depositAmount]);

  const showFirstDeliveryDiscount = useMemo(
    () =>
      fulfillmentConfirmed &&
      fulfillment === 'delivery' &&
      !deliveryFeeState.loading &&
      !deliveryFeeState.error &&
      Boolean(deliveryFeeState.data) &&
      (deliveryFeeState.data?.firstOrderBaseDeliveryDiscountAmount ?? 0) > 0,
    [
      deliveryFeeState.data,
      deliveryFeeState.error,
      deliveryFeeState.loading,
      fulfillment,
      fulfillmentConfirmed,
    ]
  );

  const deliveryAddressMissing =
    fulfillmentConfirmed &&
    fulfillmentNeedsAddress(fulfillment) &&
    !deliveryAddressId &&
    !hideShopperAddressBook;

  const firstDeliveryDiscountAmount = deliveryFeeState.data?.firstOrderBaseDeliveryDiscountAmount ?? 0;

  const stickyBreakdown = useMemo((): CheckoutStickyBreakdownLine[] => {
    const lines: CheckoutStickyBreakdownLine[] = [
      {
        label: t('client.placeOrder.summary.subtotal', 'Subtotal'),
        value: formatCatalogMoney(lineSubtotal, currency),
      },
    ];

    if (fulfillment === 'pickup') {
      // Pickup has no delivery fee; don't show a "Waived" line.
    } else if (fulfillment === 'shipping') {
      lines.push({
        label: t('client.placeOrder.summary.shippingFee', 'Shipping fee'),
        value:
          preflightLoading
            ? '…'
            : formatCatalogMoney(deliveryAmount, currency),
      });
    } else if (deliveryFeeState.loading) {
      lines.push({
        label: t('client.placeOrder.summary.deliveryFee', 'Delivery fee'),
        value: '…',
        tone: 'secondary',
      });
    } else if (deliveryAddressMissing) {
      lines.push({
        label: t('client.placeOrder.summary.deliveryFee', 'Delivery fee'),
        value: t('client.placeOrder.summary.deliveryFeePending', 'Add address'),
        tone: 'secondary',
      });
    } else if (deliveryFeeState.error) {
      lines.push({
        label: t('client.placeOrder.summary.deliveryFee', 'Delivery fee'),
        value: t('client.placeOrder.summary.deliveryFeeError', 'Unable to calculate'),
        tone: 'secondary',
      });
    } else {
      lines.push({
        label: t('client.placeOrder.summary.deliveryFee', 'Delivery fee'),
        value: formatCatalogMoney(deliveryAmount, currency),
      });
    }

    if (showFirstDeliveryDiscount && firstDeliveryDiscountAmount > 0) {
      lines.push({
        label: t('client.placeOrder.summary.firstDeliveryDiscount', 'First delivery discount'),
        value: `−${formatCatalogMoney(firstDeliveryDiscountAmount, currency)}`,
        tone: 'success',
      });
    }

    if (discountAmount > 0) {
      lines.push({
        label: t('client.placeOrder.summary.discount', 'Discount'),
        value: `−${formatCatalogMoney(discountAmount, currency)}`,
        tone: 'success',
      });
    }

    const credit = appliedPurchaseCredit({
      itemSubtotal: lineSubtotal,
      orderTotal: grandTotal,
      creditTotal: preflightConfig?.purchase_credits?.total ?? 0,
      depositNow: depositAmount,
    });
    if (credit.applied > 0) {
      lines.push({
        label: t('accounts.purchaseCredits.appliedLine', 'Store credit'),
        value: `−${formatCatalogMoney(credit.applied, currency)}`,
        tone: 'success',
      });
    }

    const amountAfterCredit = credit.applied > 0 ? credit.remaining : grandTotal;
    const dueNow =
      depositAmount != null && depositAmount > 0 ? depositAmount : amountAfterCredit;
    lines.push({
      label:
        depositAmount != null && depositAmount > 0
          ? t('deposit.dueNow', 'Due now')
          : preflightConfig?.tax_notice === 'calculated_at_checkout'
            ? t('checkout.totalBeforeTax', 'Total (before tax)')
            : t('client.placeOrder.summary.total', 'Total'),
      value: formatCatalogMoney(dueNow, currency),
      tone: 'emphasize',
    });

    if (depositAmount != null && depositAmount > 0) {
      lines.push({
        label: t('deposit.dueLater', 'Due later'),
        value: formatCatalogMoney(
          credit.applied > 0
            ? credit.dueAtFulfillment
            : Math.max(0, grandTotal - depositAmount),
          currency
        ),
        tone: 'secondary',
      });
    }

    return lines;
  }, [
    currency,
    deliveryAddressMissing,
    deliveryAmount,
    deliveryFeeState.error,
    deliveryFeeState.loading,
    depositAmount,
    discountAmount,
    firstDeliveryDiscountAmount,
    fulfillment,
    grandTotal,
    lineSubtotal,
    preflightConfig?.purchase_credits?.total,
    preflightConfig?.tax_notice,
    preflightLoading,
    showFirstDeliveryDiscount,
    t,
  ]);

  const stickyFulfillment =
    pickupEnabled || shippingEnabled ? (
      <PlaceOrderFulfillmentChoice
        compact
        value={fulfillment}
        onChange={chooseFulfillment}
        deliveryDisabled={deliveryUnavailable}
        deliveryDisabledReason={t(
          'client.placeOrder.deliveryUnavailable',
          'Delivery is currently unavailable.'
        )}
        pickupAvailable={pickupEnabled}
        shippingAvailable={shippingEnabled}
        pickupLocations={pickupLocations}
        deliveryPriceLabel={
          !deliveryAddressMissing && !deliveryFeeState.loading && !deliveryFeeState.error
            ? formatCatalogMoney(deliveryAmount, currency)
            : undefined
        }
        deliveryPriceLoading={fulfillment === 'delivery' && deliveryFeeState.loading}
        deliveryPriceHint={
          deliveryAddressMissing
            ? t(
                'client.placeOrder.deliveryPriceAddressRequired',
                'Choose an address to see the delivery price.'
              )
            : deliveryFeeState.error
              ? t('client.placeOrder.summary.deliveryFeeError', 'Unable to calculate')
              : undefined
        }
      />
    ) : null;

  const imgs = item ? catalogOrderedImages(item) : [];
  const selectedVariant =
    variantId && !isShopperBaseVariantId(variantId)
      ? item?.item.item_variants?.find((v) => v.id === variantId)
      : undefined;
  const variantGallery = orderedVariantImages(selectedVariant)
    .map((img) => img.display_url?.trim() || img.image_url?.trim() || '')
    .filter((url) => url.length > 0);
  const thumb = variantGallery[0] ?? imgs[0]?.image_url ?? null;

  useEffect(() => {
    if (!item) {
      setPhoneDialogDefaultCountry(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const addr = item.business_location?.address;
        if (!addr) {
          setPhoneDialogDefaultCountry(undefined);
          return;
        }
        const aligned = await alignCatalogAddressToCscFields({
          city: addr.city,
          state: addr.state,
          country: addr.country,
          postal_code: addr.postal_code,
        });
        const c = aligned.country?.trim().toUpperCase();
        if (cancelled) return;
        if (c === 'CM' || c === 'GA') {
          setPhoneDialogDefaultCountry(c as CountryCode);
        } else {
          setPhoneDialogDefaultCountry(undefined);
        }
      } catch {
        if (!cancelled) setPhoneDialogDefaultCountry(undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    setOverrideCountryIso(
      pickMobileMoneyDefaultCountry(phoneDialogDefaultCountry ?? sellerCountry)
    );
  }, [phoneDialogDefaultCountry, sellerCountry]);

  useEffect(() => {
    if (wizardPhase !== 'address' || !item) return;
    let cancelled = false;
    void (async () => {
      try {
        const addr = item.business_location?.address;
        if (!addr) {
          if (!cancelled) {
            setAddAddressForm({
              address_line_1: '',
              address_line_2: '',
              city: '',
              state: '',
              postal_code: '',
              country: '',
            });
          }
          return;
        }
        const aligned = await alignCatalogAddressToCscFields({
          city: addr.city,
          state: addr.state,
          country: addr.country,
          postal_code: addr.postal_code,
        });
        const hidePostal = isAfricanMarketCountry(aligned.country);
        if (!cancelled) {
          setAddAddressForm({
            address_line_1: '',
            address_line_2: '',
            city: aligned.city,
            state: aligned.state,
            country: aligned.country,
            postal_code: hidePostal ? '' : (addr.postal_code?.trim() ?? ''),
          });
        }
      } catch {
        if (!cancelled) {
          setAddAddressForm({
            address_line_1: '',
            address_line_2: '',
            city: '',
            state: '',
            postal_code: '',
            country: '',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wizardPhase, item?.id]);


  const canSubmit = useMemo(() => {
    if (!item || submitting) return false;
    if (!fulfillmentConfirmed) return false;
    const variantOk = dbVariants.length === 0 || !!variantId;
    const addrOk = fulfillment === 'pickup' || !!deliveryAddressId;
    const qtyOk = quantity >= minQ && quantity <= maxQ;
    const scheduleOk = !fulfillmentNeedsWindow(fulfillment) || deliveryScheduleOk;
    if (checkoutBlocker) return false;
    if (preflightRequest && preflightLoading) return false;
    if (stripeDeliveryAddressIncomplete) return false;
    if (fulfillment === 'delivery' && deliveryUnavailable) return false;
    if (fulfillment === 'shipping' && (!preflightConfig || !shippingEligible)) {
      return false;
    }
    
    if (isRecipientDraftIncomplete(someoneElseReceiving, recipient)) return false;
    
    return variantOk && addrOk && qtyOk && scheduleOk;
  }, [
    deliveryAddressId,
    checkoutBlocker,
    deliveryScheduleOk,
    deliveryUnavailable,
    fulfillment,
    fulfillmentConfirmed,
    item,
    maxQ,
    minQ,
    preflightConfig,
    preflightLoading,
    preflightRequest,
    quantity,
    shippingEligible,
    stripeDeliveryAddressIncomplete,
    submitting,
    variantId,
    dbVariants.length,
    someoneElseReceiving,
    recipient,
  ]);

  const onSubmit = useCallback(async () => {
    if (!item || submitting || !canSubmit) return;
    setSnack(null);
    const orderVariantId = toOrderItemVariantId(variantId);
    const line: CreateOrderPayload['items'][0] = {
      business_inventory_id: item.id,
      quantity,
      ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
    };
    const overrideValidated = validateOrderPaymentPhoneForCountry(
      overrideCountryIso,
      overrideNationalDigits
    );
    const recipientPayload = buildRecipientPayload(someoneElseReceiving, recipient);
    
    const body: CreateOrderPayload = {
      items: [line],
      fulfillment_method: fulfillment,
      ...(fulfillmentNeedsAddress(fulfillment) ? { delivery_address_id: deliveryAddressId } : {}),
      ...(fulfillmentNeedsWindow(fulfillment) && deliveryWindow
        ? { delivery_window: deliveryWindow }
        : {}),
      ...(instructions.trim() ? { special_instructions: instructions.trim() } : {}),
      payment_timing: payTiming,
      ...(!resolvedIsStripeRail && useDifferentPhone && overrideValidated.ok
        ? { phone_number: overrideValidated.e164 }
        : {}),
      ...(discountCode.appliedCode ? { discount_code: discountCode.appliedCode } : {}),
      ...(recipientPayload ? { recipient: recipientPayload } : {}),
    };

    const outcome = await placeSingleOrder({
      payload: body,
      resolvedConfig: preflightConfig ?? (resolvedIsStripeRail ? { checkout_method: 'STRIPE' } as any : null),
    });

    if (outcome.type === 'busy') return;
    if (outcome.type === 'cancelled') {
      setSnack(
        t('client.placeOrder.payment.paymentCancelled', 'Payment cancelled. Your order is awaiting payment.')
      );
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
        checkout_mode: 'single',
        order_count: 1,
      });
    }

    const orderNumber = outcome.orderNumbers[0] ?? '';
    // Navigate to MoMo waiting screen for:
    // 1. Deposit orders (deposit collect initiated), OR
    // 2. Pay_now full-pay MoMo orders
    // Non-deposit PAD/PAP MoMo must NOT enter await (would poll-timeout).
    const momoWaitingRequired =
      !resolvedIsStripeRail &&
      outcome.type === 'pending' &&
      outcome.paymentRail === 'mobile_money' &&
      (outcome.isDepositOrder === true || payTiming === 'pay_now');
    if (momoWaitingRequired) {
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
              // Only pass isDepositOrder=true for deposits (enables Back-to-checkout fail UX)
              // Pay_now full-pay gets Nest retry + onEditPhone
              isDepositOrder: outcome.isDepositOrder === true ? true : undefined,
              depositAmount: depositAmount || undefined,
              amountDue: amountDueAfterDeposit ?? undefined,
              currency,
              checkoutReturn: {
                to: 'place-order',
                inventoryItemId,
                ...(initialVariantId
                  ? { variantId: initialVariantId }
                  : toOrderItemVariantId(variantId)
                    ? { variantId: toOrderItemVariantId(variantId) }
                    : {}),
              },
            },
          },
        ],
      });
      return;
    }

    const cardAuthorized = outcome.type === 'success' && !!outcome.cardAuthorized;
    // Cooked-food MoMo: unpaid until kitchen confirm + payment request.
    const paymentCompleted =
      outcome.type === 'success' && !cardAuthorized && !isCookedFoodMoMoPayAfter;
    navigation.reset({
      index: 1,
      routes: [
        { name: 'ClientMainTabs' },
        {
          name: 'OrderPlacedSuccess',
          params: {
            orderNumbers: [orderNumber],
            paymentTiming: payTiming,
            paymentCompleted,
            cardAuthorized,
            fulfillment,
            cookedFoodPayAfterConfirm: isCookedFoodMoMoPayAfter,
          },
        },
      ],
    });
  }, [
    deliveryAddressId,
    canSubmit,
    submitting,
    discountCode.appliedCode,
    deliveryWindow,
    fulfillment,
    instructions,
    resolvedIsStripeRail,
    item,
    meUser?.phone_number,
    navigation,
    overrideCountryIso,
    overrideNationalDigits,
    payTiming,
    placeSingleOrder,
    preflightConfig,
    quantity,
    t,
    useDifferentPhone,
    variantId,
    depositAmount,
    amountDueAfterDeposit,
    currency,
    inventoryItemId,
    initialVariantId,
    isCookedFoodMoMoPayAfter,
  ]);

  if (itemLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={[typography.body2, { color: colors.text.secondary, marginTop: spacing.md }]}>
          {t('client.placeOrder.loading', 'Loading…')}
        </Text>
      </View>
    );
  }

  if (itemError || !item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <Text style={[typography.body1, { color: colors.error.main, textAlign: 'center' }]}>
          {itemError || t('public.items.detail.notFound', 'Item not found')}
        </Text>
        <Button mode="contained-tonal" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          {t('public.items.detail.goBack', 'Back')}
        </Button>
      </View>
    );
  }

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
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.md,
        }}
      >
        <CheckoutProgressStepper
          steps={[
            { key: 'buy', label: t('checkout.progress.buy', 'Buy now') },
            { key: 'checkout', label: t('checkout.progress.checkout', 'Checkout') },
            { key: 'pay', label: t('checkout.progress.pay', 'Pay') },
          ]}
          currentStep="checkout"
        />

        {/* Diaspora checkout banner + recipient (always someone-else when diaspora) */}
        {fulfillmentConfirmed && isDiaspora ? (
          <>
            <DiasporaCheckoutBanner
              diaspora={diasporaContext}
              style={{ marginBottom: spacing.sm }}
            />

            <RecipientPicker
              recipient={recipient}
              onChange={setRecipient}
              onSavedSelectionChange={onSavedRecipientSelection}
              country={sellerCountry}
              defaultCountryCode={
                sellerCountry && (sellerCountry === 'CM' || sellerCountry === 'GA')
                  ? (sellerCountry as CountryCode)
                  : undefined
              }
              disabled={submitting}
              style={{ marginBottom: spacing.sm }}
            />
          </>
        ) : null}

        {fulfillmentConfirmed &&
        fulfillmentNeedsAddress(fulfillment) &&
        sendingOrderHome &&
        !hideShopperAddressBook ? (
          <>
            <PlaceOrderDeliveryAddressBlock
              addresses={addressesForDelivery}
              selectedId={deliveryAddressId}
              onSelect={selectDeliveryAddress}
              loading={addrLoading}
              error={addrError}
              onRetry={() => void refetchAddresses()}
              onAddAddress={openAddAddressModal}
              warnIncomplete={resolvedIsStripeRail}
              title={recipientAddressTitle}
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
            {stripeDeliveryAddressIncomplete ? (
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
          </>
        ) : null}

        {depositAmount != null &&
        depositAmount > 0 &&
        !isCookedFoodOrder &&
        !isDiaspora &&
        !resolvedIsStripeRail ? (
          <ReservationDepositExplainer
            depositAmount={depositAmount}
            currency={currency}
            isFloorAmount={depositIsFloor}
            grandTotal={grandTotal}
            style={{ marginBottom: spacing.sm }}
          />
        ) : null}

        <PlaceOrderSummaryCard
          thumb={thumb}
          itemName={item.item.name}
          storeName={item.business_location?.name ?? ''}
          currency={currency}
          unitMoney={unitMoney}
          quantity={quantity}
          subtotal={lineSubtotal}
          fulfillment={fulfillment}
          fulfillmentPending={!fulfillmentConfirmed}
          deliveryFeeLoading={
            fulfillment === 'shipping' ? preflightLoading : deliveryFeeState.loading
          }
          deliveryFeeError={
            fulfillment === 'shipping' ? null : deliveryFeeState.error
          }
          deliveryAddressMissing={deliveryAddressMissing}
          deliveryAmount={deliveryAmount}
          deliveryFullBefore={deliveryFullBefore}
          showFirstDeliveryDiscount={showFirstDeliveryDiscount}
          firstDeliveryDiscountAmount={firstDeliveryDiscountAmount}
          discountDraft={discountCode.draft}
          onDiscountDraftChange={discountCode.setDraft}
          onApplyDiscount={discountCode.apply}
          onClearDiscount={discountCode.clear}
          discountLoading={discountCode.loading}
          discountError={discountCode.error}
          appliedDiscountCode={discountCode.appliedCode}
          discountPercentage={discountCode.percentage}
          discountAmount={discountAmount}
          grandTotal={grandTotal}
          depositAmount={depositAmount}
          showDepositBreakdown={depositAmount != null && depositAmount > 0}
          showTaxAtCheckoutNotice={
            preflightConfig?.tax_notice === 'calculated_at_checkout'
          }
          hideFinancialSummary
        />

        {variants.length > 0 && item ? (
          <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <VariantOptionPicker
              variants={variants}
              value={variantId}
              onChange={setVariantId}
              listingSellingPrice={item.selling_price}
              priceOverrides={item.variant_price_overrides}
              hasActiveDeal={item.hasActiveDeal}
              originalPrice={item.original_price}
              discountedPrice={item.discounted_price}
              currency={item.item.currency || 'XAF'}
            />
          </View>
        ) : null}

        <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
          <Text variant="titleSmall" style={{ marginBottom: spacing.sm }}>
            {t('client.placeOrder.quantity', 'Quantity')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <IconButton icon="minus" mode="outlined" disabled={quantity <= minQ} onPress={() => setQuantity((q) => Math.max(minQ, q - 1))} />
            <Text variant="titleMedium" style={{ minWidth: 32, textAlign: 'center' }}>
              {quantity}
            </Text>
            <IconButton icon="plus" mode="outlined" disabled={quantity >= maxQ} onPress={() => setQuantity((q) => Math.min(maxQ, q + 1))} />
            <Text variant="bodySmall" style={{ color: colors.text.secondary, flex: 1 }}>
              {t('client.placeOrder.quantityHint', 'Max {{max}} available', { max: maxQ })}
            </Text>
          </View>
        </View>

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

        {fulfillmentConfirmed &&
        fulfillment === 'pickup' &&
        !isDiaspora &&
        !(item != null && isFoodCatalogItem(item) && !resolvedIsStripeRail) ? (
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
              pickupEnabled
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
              pickupEnabled
                ? t('client.placeOrder.switchToPickup', 'Switch to pickup')
                : undefined
            }
            onAction={pickupEnabled ? switchToPickupFromUnavailable : undefined}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillmentNeedsAddress(fulfillment) && !sendingOrderHome ? (
          <PlaceOrderDeliveryAddressBlock
            addresses={addressesForDelivery}
            selectedId={deliveryAddressId}
            onSelect={selectDeliveryAddress}
            loading={addrLoading}
            error={addrError}
            onRetry={() => void refetchAddresses()}
            onAddAddress={openAddAddressModal}
            warnIncomplete={resolvedIsStripeRail}
            title={captureRecipientAddress ? recipientAddressTitle : undefined}
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

        {stripeDeliveryAddressIncomplete && !sendingOrderHome ? (
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
            businessLocationId={item.business_location?.id ?? ''}
            scheduleRequired={!!preflightConfig?.schedule_required}
            allowSchedule={preflightConfig?.schedule_allowed !== false && !isFoodCatalogItem(item)}
            payAfterConfirm={isCookedFoodMoMoPayAfter}
            estimatedReadyAt={preflightConfig?.estimated_ready_at}
            estimatedFulfillBy={preflightConfig?.estimated_fulfill_by}
            opensAt={preflightConfig?.opens_at}
            onReadyChange={onDwReadyChange}
            onCommit={onDwCommit}
          />
        ) : null}

        {fulfillmentConfirmed && fulfillment === 'pickup' ? (
          <PlaceOrderDeliveryWindowBlock
            countryCode={item.business_location?.address?.country?.trim() ?? ''}
            stateCode={item.business_location?.address?.state?.trim() ?? ''}
            enabled={Boolean(
              item.business_location?.address?.country?.trim() &&
                item.business_location?.address?.state?.trim()
            )}
            fulfillment="pickup"
            businessLocationId={item.business_location?.id ?? ''}
            scheduleRequired={!!preflightConfig?.schedule_required}
            allowSchedule={preflightConfig?.schedule_allowed !== false && !isFoodCatalogItem(item)}
            payAfterConfirm={isCookedFoodMoMoPayAfter}
            estimatedReadyAt={preflightConfig?.estimated_ready_at}
            estimatedFulfillBy={preflightConfig?.estimated_fulfill_by}
            opensAt={preflightConfig?.opens_at}
            onReadyChange={onDwReadyChange}
            onCommit={onDwCommit}
          />
        ) : null}

        {/* Diaspora: show indicative FX estimate when available */}
        {fulfillmentConfirmed && isDiaspora && diasporaContext?.payer_charge_estimate ? (
          <View style={[styles.block, { borderColor: colors.divider, backgroundColor: colors.surface, borderRadius: borderRadius.md }]}>
            <PayerChargeSummary diaspora={diasporaContext} locale={t('common.locale', 'en')} />
          </View>
        ) : null}

        {/* Payment timing (Pay now / Pay at delivery) — hidden for cooked-food MoMo */}
        {fulfillmentConfirmed &&
        fulfillment === 'delivery' &&
        payAtDeliveryEnabled &&
        !isDiaspora &&
        momoPayNowDeliveryEnabled &&
        !isCookedFoodMoMoPayAfter ? (
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

        <PlaceOrderSpecialInstructions
          value={instructions}
          onChangeText={setInstructions}
        />

        {checkoutBlocker &&
        checkoutBlocker.code !== 'COOKED_FOOD_STORE_CLOSED' ? (
          <NoticeBanner
            tone="error"
            icon="alert-circle-outline"
            message={checkoutBlocker.message}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </ScrollView>

      <View>
        {checkoutBlocker?.code === 'COOKED_FOOD_STORE_CLOSED' ? (
          <KitchenClosedStickyPanel
            topContent={stickyFulfillment}
            details={checkoutBlocker.details}
            message={checkoutBlocker.message}
          />
        ) : (
          <CheckoutStickyActionBar
            topContent={stickyFulfillment}
            breakdown={stickyBreakdown}
            label={
              resolvedIsStripeRail
                ? t('checkout.payNow', 'Pay now')
                : depositAmount != null && depositAmount > 0
                  ? t('deposit.payDepositCta', 'Pay deposit · {{amount}} {{currency}}', {
                      amount: depositAmount,
                      currency,
                    })
                  : payTiming === 'pay_now'
                    ? t('checkout.payWithMoMo', 'Pay with MoMo')
                    : t('client.placeOrder.submit', 'Place order')
            }
            onPress={() => { if (!submitting) void onSubmit(); }}
            loading={submitting}
            disabled={!canSubmit}
            disabledReason={
              isRecipientDraftIncomplete(someoneElseReceiving, recipient)
                ? t('diaspora.selectRecipientToPay', 'Select a recipient before paying')
                : captureRecipientAddress && !deliveryAddressId
                  ? t('diaspora.selectRecipientAddressToPay', 'Add the recipient’s delivery address before paying')
                  : undefined
            }
          />
        )}
      </View>
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
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
          <View
            style={[
              styles.modalBox,
              { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderColor: colors.divider },
            ]}
          >
            <ScrollView {...keyboardAwareScrollProps} showsVerticalScrollIndicator={false}>
              <Text variant="titleLarge" style={{ marginBottom: spacing.md, color: colors.text.primary }}>
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
                <Button
                  mode="outlined"
                  style={{ flex: 1 }}
                  onPress={() => !addAddressSaving && setAddAddressModalVisible(false)}
                  disabled={addAddressSaving}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  mode="contained"
                  style={{ flex: 1 }}
                  onPress={() => void submitAddAddress()}
                  loading={addAddressSaving}
                  disabled={addAddressSaving}
                >
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
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  block: { padding: 16, borderWidth: 1, marginBottom: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    maxHeight: '88%',
    padding: 20,
    borderWidth: 1,
  },
});
