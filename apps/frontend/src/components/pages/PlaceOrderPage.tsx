import {
  Add,
  ArrowBack,
  CheckCircle,
  LocalShipping,
  LocationOn,
  PaymentsOutlined,
  Phone,
  ScheduleOutlined,
  Security,
  ShoppingCart,
  Verified,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Step,
  StepButton,
  Stepper,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { alpha, keyframes, Theme } from '@mui/material/styles';
import { parsePhoneNumber } from 'libphonenumber-js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAddressManager } from '../../hooks/useAddressManager';
import { useApiClient } from '../../hooks/useApiClient';
import { useCountryStateCity } from '../../hooks/useCountryStateCity';
import { useDeliveryFee } from '../../hooks/useDeliveryFee';
import { useDeliveryTimeSlots } from '../../hooks/useDeliveryTimeSlots';
import { useDiscountCode } from '../../hooks/useDiscountCode';
import { useFastDeliveryConfig } from '../../hooks/useFastDeliveryConfig';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import { useMetaPixel } from '../../hooks/useMetaPixel';
import { useSupportedPaymentSystems } from '../../hooks/useSupportedPaymentSystems';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import {
  metaPixelContentCategoryFromItem,
  metaPixelGoogleProductCategoryFromItem,
} from '../../utils/metaPixelContentCategory';
import type { ImageType } from '../../types/image';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../../types/itemVariant';
import { orderedItemImages } from '../../utils/orderedItemImages';
import VariantSelector from '../common/VariantSelector';
import { CmAcceptedPaymentLogos } from '../common/CmAcceptedPaymentLogos';
import PhoneInput from '../common/PhoneInput';
import DeliveryTimeWindowSelector, {
  DeliveryWindowData,
} from '../common/DeliveryTimeWindowSelector';
import FastDeliveryOption from '../common/FastDeliveryOption';
import PlacingOrderOverlay from '../common/PlacingOrderOverlay';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';
import MissingEmailDialog from '../dialogs/MissingEmailDialog';

const confirmOrderPulse = keyframes`
  0%, 100% {
    transform: translateY(0);
    box-shadow: 0 0 0 0 var(--confirm-order-ring-color);
  }
  45% {
    transform: translateY(-1px);
    box-shadow: 0 0 0 10px transparent;
  }
`;

const getConfirmOrderAttentionSx = (enabled: boolean) => (theme: Theme) => ({
  ...(enabled
    ? {
        '--confirm-order-ring-color': alpha(
          theme.palette.primary.main,
          theme.palette.mode === 'dark' ? 0.38 : 0.26
        ),
        animation: `${confirmOrderPulse} 2.8s ease-in-out infinite`,
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }
    : null),
});

// Loading Skeleton Component
const OrderPageSkeleton: React.FC = () => {
  return (
    <Container
        maxWidth="xl"
        sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, sm: 2 } }}
      >
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton
            variant="rectangular"
            height={400}
            sx={{ borderRadius: 2, mb: 3 }}
          />
          <Skeleton
            variant="rectangular"
            height={300}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Skeleton
            variant="rectangular"
            height={500}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

// Step icon for mobile wizard - numbers only, no labels
const StepIconWrapper: React.FC<{
  completed?: boolean;
  active?: boolean;
  children: React.ReactNode;
}> = ({ completed, active, children }) => (
  <Box
    sx={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.875rem',
      fontWeight: 600,
      bgcolor: completed ? 'primary.main' : active ? 'primary.main' : 'action.hover',
      color: completed || active ? 'primary.contrastText' : 'text.secondary',
      border: active && !completed ? 2 : 0,
      borderColor: 'primary.main',
    }}
  >
    {children}
  </Box>
);

// Order Summary Component
interface OrderSummaryProps {
  selectedItem: {
    selling_price: number;
    original_price?: number;
    discounted_price?: number;
    hasActiveDeal?: boolean;
    deal_end_at?: string;
    item: {
      name: string;
      currency: string;
      item_images?: Array<{ image_url: string; image_type?: ImageType }>;
    };
  };
  /** Unit price after variant base + listing deal scaling (matches checkout total). */
  resolvedPricing: {
    unit: number;
    strikeOriginal?: number;
    hasDeal: boolean;
  };
  /** Thumbnail in summary (e.g. variant primary image). */
  displayImageSrc?: string | null;
  variantLabel?: string | null;
  quantity: number;
  /** Desktop: quantity dropdown lives in the summary panel (same pattern as mobile review). */
  onQuantityChange: (quantity: number) => void;
  /** Max selectable quantity (e.g. min(stock, 10)). */
  maxOrderQuantity: number;
  deliveryFee: number | null;
  deliveryFeeLoading: boolean;
  deliveryFeeError: string | null;
  /** True when addresses finished loading but none is selected (e.g. user must add one). */
  deliveryAddressMissing?: boolean;
  firstOrderBaseDeliveryDiscountAmount?: number;
  deliveryFeeFullBeforeDiscount?: number;
  requiresFastDelivery: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  discountCodeDraft: string;
  onDiscountCodeDraftChange: (value: string) => void;
  onApplyDiscountCode: () => void;
  onClearDiscountCode: () => void;
  appliedDiscountCode: string;
  discountPercentage: number;
  discountLoading: boolean;
  discountError: string | null;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
  isMobile: boolean;
  error?: string | null;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  selectedItem,
  resolvedPricing,
  displayImageSrc,
  variantLabel,
  quantity,
  onQuantityChange,
  maxOrderQuantity,
  deliveryFee,
  deliveryFeeLoading,
  deliveryFeeError,
  deliveryAddressMissing = false,
  firstOrderBaseDeliveryDiscountAmount = 0,
  deliveryFeeFullBeforeDiscount,
  requiresFastDelivery,
  formatCurrency,
  discountCodeDraft,
  onDiscountCodeDraftChange,
  onApplyDiscountCode,
  onClearDiscountCode,
  appliedDiscountCode,
  discountPercentage,
  discountLoading,
  discountError,
  onSubmit,
  loading,
  disabled,
  isMobile,
  error,
}) => {
  const { t } = useTranslation();
  const hasDealPrices = resolvedPricing.hasDeal;
  const unitPrice = resolvedPricing.unit;

  const subtotal = unitPrice * quantity;
  // Delivery fee is the API delivery fee (already includes fast delivery charge if applicable)
  const computedDeliveryFee = deliveryFee || 0;
  // Total = subtotal + delivery fee (fast delivery already included in deliveryFee from API)
  const total = subtotal + computedDeliveryFee;
  const discountAmount =
    appliedDiscountCode && discountPercentage > 0
      ? Number(((total * discountPercentage) / 100).toFixed(2))
      : 0;
  const totalAfterDiscount = Math.max(0, total - discountAmount);

  return (
    <Paper
      elevation={isMobile ? 0 : 2}
      sx={{
        p: 3,
        position: isMobile ? 'fixed' : 'sticky',
        top: isMobile ? 'auto' : 100,
        // Position above bottom nav (64px) with extra padding (16px) for better visibility
        bottom: isMobile ? '80px' : 'auto',
        left: isMobile ? 0 : 'auto',
        right: isMobile ? 0 : 'auto',
        zIndex: isMobile ? 999 : 'auto', // Below bottom nav (1000) but above content
        bgcolor: 'background.paper',
        borderRadius: isMobile ? 0 : 2,
        borderTop: isMobile ? 1 : 0,
        borderColor: 'divider',
        boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.1)' : 2,
        // Safe area padding for devices with notches
        paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0))' : 3,
      }}
    >
      <Typography variant="h6" gutterBottom fontWeight="bold">
        {t('orders.orderSummary', 'Order Summary')}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {!isMobile && (
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="desktop-order-summary-quantity">
            {t('orders.quantity', 'Quantity')}
          </InputLabel>
          <Select
            labelId="desktop-order-summary-quantity"
            value={quantity}
            label={t('orders.quantity', 'Quantity')}
            onChange={(e) => onQuantityChange(e.target.value as number)}
            disabled={loading}
          >
            {Array.from({ length: maxOrderQuantity }, (_, i) => i + 1).map(
              (num) => (
                <MenuItem key={num} value={num}>
                  {num}{' '}
                  {num === 1
                    ? t('orders.unitSingular', 'unit')
                    : t('orders.unitsPlural', 'units')}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>
      )}

      {/* Item Summary */}
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {displayImageSrc ||
          selectedItem.item.item_images?.length ? (
            <Box
              component="img"
              src={
                displayImageSrc ||
                (selectedItem.item.item_images?.find((img) => img.image_type === 'main')
                  ?.image_url ||
                  selectedItem.item.item_images?.[0]?.image_url)
              }
              alt={selectedItem.item.name}
              sx={{
                width: isMobile ? 60 : 120,
                height: isMobile ? 60 : 120,
                flexShrink: 0,
                borderRadius: 1,
                objectFit: 'cover',
              }}
            />
          ) : null}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight="medium" noWrap>
              {selectedItem.item.name}
            </Typography>
            {variantLabel?.trim() ? (
              <Typography variant="caption" color="text.secondary" display="block">
                {variantLabel}
              </Typography>
            ) : null}
            {isMobile && (
              <Typography variant="caption" color="text.secondary" display="block">
                {t('orders.quantity', 'Quantity')}: {quantity}
              </Typography>
            )}
          </Box>
        </Box>

        {hasDealPrices ? (
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: 'line-through' }}
            >
              {formatCurrency(
                resolvedPricing.strikeOriginal ?? selectedItem.selling_price,
                selectedItem.item.currency
              )}
            </Typography>
            <Typography variant="h6" color="primary" fontWeight="bold">
              {formatCurrency(unitPrice, selectedItem.item.currency)}
            </Typography>
            {selectedItem.deal_end_at && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.25 }}
              >
                {t('orders.dealEnds', 'Deal ends on {{date}}', {
                  date: new Date(selectedItem.deal_end_at).toLocaleDateString(
                    undefined,
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  ),
                })}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="h6" color="primary" fontWeight="bold">
            {formatCurrency(unitPrice, selectedItem.item.currency)}
          </Typography>
        )}

        {/* Price Breakdown */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('orders.subtotal', 'Subtotal')}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatCurrency(subtotal, selectedItem.item.currency)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('orders.deliveryFee', 'Delivery Fee')}
            </Typography>
            <Box sx={{ textAlign: 'right', maxWidth: { xs: '100%', sm: 280 }, ml: 'auto' }}>
              {deliveryFeeLoading ? (
                <CircularProgress size={14} />
              ) : deliveryAddressMissing ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.45 }}
                >
                  {t(
                    'orders.deliveryFeeAddressRequired',
                    'Add a delivery address to calculate shipping and complete your order.'
                  )}
                </Typography>
              ) : deliveryFeeError ? (
                <Typography variant="body2" color="error">
                  {t('common.error', 'Error')}
                </Typography>
              ) : deliveryFeeFullBeforeDiscount != null &&
                deliveryFeeFullBeforeDiscount > computedDeliveryFee ? (
                <>
                  <Typography
                    variant="body2"
                    component="span"
                    sx={{
                      textDecoration: 'line-through',
                      color: 'text.secondary',
                      mr: 1,
                    }}
                  >
                    {formatCurrency(
                      deliveryFeeFullBeforeDiscount,
                      selectedItem.item.currency
                    )}
                  </Typography>
                  <Typography variant="body2" fontWeight="medium" component="span">
                    {formatCurrency(
                      computedDeliveryFee,
                      selectedItem.item.currency
                    )}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" fontWeight="medium" component="span">
                  {formatCurrency(computedDeliveryFee, selectedItem.item.currency)}
                </Typography>
              )}
            </Box>
          </Box>

          {!deliveryFeeLoading &&
            !deliveryAddressMissing &&
            !deliveryFeeError &&
            firstOrderBaseDeliveryDiscountAmount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="success.main">
                  {t('orders.firstDeliveryDiscount', 'First delivery discount')}
                </Typography>
                <Typography variant="body2" color="success.main" fontWeight="medium">
                  −
                  {formatCurrency(
                    firstOrderBaseDeliveryDiscountAmount,
                    selectedItem.item.currency
                  )}
                </Typography>
              </Box>
            )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
              {t('orders.discountCode.label', 'Discount code')}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                value={discountCodeDraft}
                onChange={(e) => onDiscountCodeDraftChange(e.target.value)}
                disabled={loading || discountLoading}
                placeholder={t(
                  'orders.discountCode.placeholder',
                  'Enter code'
                )}
                error={!!discountError}
                helperText={
                  discountError
                    ? discountError
                    : appliedDiscountCode
                      ? t(
                          'orders.discountCode.applied',
                          'Applied: {{code}} ({{pct}}% off)',
                          { code: appliedDiscountCode, pct: discountPercentage }
                        )
                      : ' '
                }
              />
              {appliedDiscountCode ? (
                <Button
                  variant="outlined"
                  onClick={onClearDiscountCode}
                  disabled={loading || discountLoading}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {t('common.clear', 'Clear')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={onApplyDiscountCode}
                  disabled={!discountCodeDraft.trim() || loading || discountLoading}
                  sx={{ whiteSpace: 'nowrap' }}
                  startIcon={discountLoading ? <CircularProgress size={16} /> : undefined}
                >
                  {t('orders.discountCode.apply', 'Apply')}
                </Button>
              )}
            </Stack>
          </Box>

          {discountAmount > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, mt: 1 }}>
              <Typography variant="body2" color="success.main">
                {t('orders.discountCode.discount', 'Discount')}
              </Typography>
              <Typography variant="body2" color="success.main" fontWeight="medium">
                −{formatCurrency(discountAmount, selectedItem.item.currency)}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              {t('orders.total', 'Total')}
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">
              {formatCurrency(totalAfterDiscount, selectedItem.item.currency)}
            </Typography>
          </Box>
        </Box>

        {/* Trust Indicators */}
        <Stack direction="row" spacing={1} sx={{ py: 2 }}>
          <Security fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            {t('orders.securePayment', 'Secure Payment')}
          </Typography>
        </Stack>

        {/* Error Display - shown next to place order button */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* CTA Button */}
        <Button
          onClick={onSubmit}
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled || loading}
          startIcon={
            loading ? <CircularProgress size={20} /> : <ShoppingCart />
          }
          sx={(theme) => ({
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 3,
            ...getConfirmOrderAttentionSx(!disabled && !loading)(theme),
            '&:hover': {
              boxShadow: 6,
            },
          })}
        >
          {loading
            ? t('orders.placingOrder', 'Placing Order...')
            : t('orders.confirmOrder', 'Place order')}
        </Button>
      </Stack>
    </Paper>
  );
};

const PlaceOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const apiClient = useApiClient();
  const { module: countryStateCity } = useCountryStateCity();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get supported payment systems
  const {
    isCountrySupported,
    supportedCountries,
    loading: paymentSystemsLoading,
  } = useSupportedPaymentSystems();

  const { trackOnMount } = useTrackItemView(id || null);
  const { trackPurchase } = useMetaPixel();

  useEffect(() => {
    if (id) {
      trackOnMount();
    }
  }, [id, trackOnMount]);

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    appliedCode: appliedDiscountCode,
    discountPercentage,
    loading: discountLoading,
    error: discountError,
    applyCode: applyDiscountCode,
    clear: clearDiscountCode,
  } = useDiscountCode();
  const [discountCodeDraft, setDiscountCodeDraft] = useState('');
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overridePhoneNumber, setOverridePhoneNumber] = useState('');
  const [missingEmailDialogOpen, setMissingEmailDialogOpen] = useState(false);
  const [missingPhoneDialogOpen, setMissingPhoneDialogOpen] = useState(false);
  const [missingPhoneNumber, setMissingPhoneNumber] = useState('');
  const [missingPhoneSaving, setMissingPhoneSaving] = useState(false);
  const [missingPhoneError, setMissingPhoneError] = useState<string | null>(null);
  const [missingPhoneCountry, setMissingPhoneCountry] = useState<string>('');
  const [missingPhoneNationalNumber, setMissingPhoneNationalNumber] = useState('');
  const [requiresFastDelivery, setRequiresFastDelivery] = useState(false);
  const [deliveryWindow, setDeliveryWindow] =
    useState<DeliveryWindowData | null>(null);
  const [paymentTiming, setPaymentTiming] = useState<
    'pay_now' | 'pay_at_delivery'
  >('pay_now');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentChoiceDialogOpen, setPaymentChoiceDialogOpen] = useState(false);
  
  // Wizard step state (mobile full-screen dialog only). Step 0 merges delivery options + address.
  const [activeStep, setActiveStep] = useState(0);
  const steps = isMobile
    ? [
        t('orders.step.deliveryOptionsAndAddress', 'Delivery & Address'),
        t('orders.step.review', 'Review & Place Order'),
      ]
    : [
        t('orders.step.deliveryOptions', 'Delivery Options'),
        t('orders.step.address', 'Delivery Address'),
        t('orders.step.review', 'Review & Place Order'),
      ];

  const handleDeliveryWindowChange = useCallback(
    (data: DeliveryWindowData | null) => {
      setDeliveryWindow(data);
    },
    []
  );

  // Address Dialog State
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressDialogMode, setAddressDialogMode] = useState<'normal' | 'anon'>(
    'normal'
  );
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [didAutoOpenAnonAddress, setDidAutoOpenAnonAddress] = useState(false);
  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: false,
  });

  const isAnonFlow = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('anon') === '1';
  }, [location.search]);

  const anonAddressDone = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('anonAddressDone') === '1';
  }, [location.search]);

  // Get inventory item
  const { inventoryItem: selectedItem, loading: inventoryLoading } =
    useInventoryItem(id || null);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const activeVariants = useMemo(() => {
    const raw = selectedItem?.item?.item_variants ?? [];
    return [...raw]
      .filter((v) => v.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [selectedItem]);

  const variantIdsKey = useMemo(
    () => activeVariants.map((v) => v.id).join(','),
    [activeVariants]
  );

  useEffect(() => {
    if (!selectedItem) return;
    const variants = [...(selectedItem.item?.item_variants ?? [])]
      .filter((v) => v.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (variants.length === 0) {
      setSelectedVariantId(null);
      return;
    }
    if (variants.length === 1) {
      setSelectedVariantId(variants[0].id);
      return;
    }
    const def = variants.find((v) => v.is_default);
    setSelectedVariantId(def?.id ?? variants[0].id);
  }, [selectedItem?.id, variantIdsKey, selectedItem]);

  const selectedVariant = useMemo(() => {
    if (!selectedVariantId) return null;
    return activeVariants.find((v) => v.id === selectedVariantId) ?? null;
  }, [activeVariants, selectedVariantId]);

  const listingUnitPricing = useMemo(() => {
    if (!selectedItem) {
      return {
        unit: 0,
        hasDeal: false,
        strikeOriginal: undefined as number | undefined,
      };
    }
    const base = effectiveVariantUnitPrice(selectedVariant, selectedItem.selling_price);
    return unitPriceWithListingDeal(
      base,
      selectedItem.selling_price,
      selectedItem.hasActiveDeal,
      selectedItem.original_price,
      selectedItem.discounted_price
    );
  }, [selectedItem, selectedVariant]);

  const specWeightDisplay = useMemo(() => {
    if (
      selectedVariant?.weight != null &&
      Number(selectedVariant.weight) > 0
    ) {
      return {
        value: selectedVariant.weight,
        unit:
          selectedVariant.weight_unit ?? selectedItem?.item.weight_unit ?? '',
      };
    }
    if (
      selectedItem?.item.weight != null &&
      selectedItem.item.weight > 0
    ) {
      return {
        value: selectedItem.item.weight,
        unit: selectedItem.item.weight_unit ?? '',
      };
    }
    return null;
  }, [selectedItem, selectedVariant]);

  const specDimensionsDisplay = useMemo(() => {
    const fromVariant = selectedVariant?.dimensions?.trim();
    if (fromVariant) return fromVariant;
    return selectedItem?.item.dimensions?.trim() ?? '';
  }, [selectedItem, selectedVariant]);

  const orderedSelectedItemImages = useMemo(() => {
    type PlaceOrderItemImage = {
      id?: string;
      image_url: string;
      image_type?: ImageType;
      alt_text?: string;
      caption?: string;
      display_order?: number;
    };

    const imgs = (selectedItem?.item?.item_images ?? []) as PlaceOrderItemImage[];
    const normalized: Array<PlaceOrderItemImage & { image_type: ImageType }> =
      imgs.map((img) => ({
        ...img,
        image_type: img.image_type ?? 'gallery',
      }));

    return orderedItemImages(normalized);
  }, [selectedItem?.item?.item_images]);

  const [selectedItemImageIndex, setSelectedItemImageIndex] = useState(0);
  const [itemImagePreviewOpen, setItemImagePreviewOpen] = useState(false);
  useEffect(() => {
    setSelectedItemImageIndex(0);
  }, [selectedItem?.id]);

  const variantPrimaryImageUrl = useMemo(
    () => primaryVariantImageUrl(selectedVariant),
    [selectedVariant]
  );

  const heroDisplayUrl = useMemo(() => {
    if (variantPrimaryImageUrl) return variantPrimaryImageUrl;
    return (
      orderedSelectedItemImages[selectedItemImageIndex]?.image_url ??
      orderedSelectedItemImages[0]?.image_url
    );
  }, [variantPrimaryImageUrl, orderedSelectedItemImages, selectedItemImageIndex]);

  const openSelectedItemImagePreview = useCallback(
    (index = 0) => {
      if (!orderedSelectedItemImages.length) return;
      const safeIndex = Math.min(
        Math.max(index, 0),
        orderedSelectedItemImages.length - 1
      );
      setSelectedItemImageIndex(safeIndex);
      setItemImagePreviewOpen(true);
    },
    [orderedSelectedItemImages]
  );

  const closeSelectedItemImagePreview = useCallback(() => {
    setItemImagePreviewOpen(false);
  }, []);

  const showPreviousPreviewImage = useCallback(() => {
    if (orderedSelectedItemImages.length < 2) return;
    setSelectedItemImageIndex((prev) =>
      prev === 0 ? orderedSelectedItemImages.length - 1 : prev - 1
    );
  }, [orderedSelectedItemImages.length]);

  const showNextPreviewImage = useCallback(() => {
    if (orderedSelectedItemImages.length < 2) return;
    setSelectedItemImageIndex((prev) =>
      prev === orderedSelectedItemImages.length - 1 ? 0 : prev + 1
    );
  }, [orderedSelectedItemImages.length]);

  const isPayAtDeliveryEligible = !!selectedItem?.item?.pay_on_delivery_enabled;

  useEffect(() => {
    if (!isPayAtDeliveryEligible && paymentTiming !== 'pay_now') {
      setPaymentTiming('pay_now');
    }
  }, [isPayAtDeliveryEligible, paymentTiming]);

  /** ISO country of the selling location — default delivery address country for this item. */
  const itemOriginCountryIso = useMemo(
    () => selectedItem?.business_location?.address?.country?.trim() ?? '',
    [selectedItem]
  );

  const itemOriginState = useMemo(
    () => selectedItem?.business_location?.address?.state?.trim() ?? '',
    [selectedItem]
  );

  const itemOriginCity = useMemo(
    () => selectedItem?.business_location?.address?.city?.trim() ?? '',
    [selectedItem]
  );

  // Get delivery fee for the selected item
  const {
    deliveryFee,
    loading: deliveryFeeLoading,
    error: deliveryFeeError,
  } = useDeliveryFee(
    selectedItem?.id || null,
    selectedAddressId,
    requiresFastDelivery
  );

  // Get client addresses
  const {
    addresses,
    loading: addressesLoading,
    addAddress,
    updateAddress,
  } = useAddressManager({
    entityType: 'client',
    entityId: profile?.client?.id || '',
    onAddressesChanged: refetchProfile,
  });

  // Get fast delivery configuration
  const selectedAddress = addresses.find(
    (addr) => addr.address.id === selectedAddressId
  )?.address;
  const deliveryAddressMissing =
    !addressesLoading && !selectedAddressId;
  // Only query fast delivery config when we have a real address selection.
  // Avoid defaulting to an arbitrary country/state which can incorrectly surface the UI.
  const userCountry = selectedAddress?.country?.trim() ?? '';
  const userState = selectedAddress?.state?.trim() ?? '';

  const { config: fastDeliveryConfig, isEnabledForLocation } =
    useFastDeliveryConfig(userCountry, userState);

  // Fetch delivery time slot details for summary display
  const {
    slots: deliverySlots,
    loading: slotsLoading,
    fetchSlots: fetchDeliverySlots,
  } = useDeliveryTimeSlots();

  // Fetch slot details when delivery window is set and we have address
  useEffect(() => {
    if (
      deliveryWindow?.slot_id &&
      deliveryWindow?.preferred_date &&
      selectedAddress
    ) {
      fetchDeliverySlots(
        selectedAddress.country,
        selectedAddress.state,
        deliveryWindow.preferred_date,
        requiresFastDelivery
      );
    }
  }, [
    deliveryWindow?.slot_id,
    deliveryWindow?.preferred_date,
    selectedAddress,
    requiresFastDelivery,
    fetchDeliverySlots,
  ]);

  // Find the selected slot
  const selectedSlot = useMemo(() => {
    if (!deliveryWindow?.slot_id || !deliverySlots.length) return null;
    return deliverySlots.find((slot) => slot.id === deliveryWindow.slot_id);
  }, [deliveryWindow?.slot_id, deliverySlots]);

  const deliveryReviewDateLabel = useMemo(() => {
    if (!deliveryWindow?.preferred_date) return '';
    return new Date(deliveryWindow.preferred_date).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [deliveryWindow?.preferred_date]);

  // Set default address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((addr) => addr.address.is_primary);
      setSelectedAddressId(
        primaryAddress?.address.id || addresses[0].address.id
      );
    }
  }, [addresses, selectedAddressId]);

  // Anonymous flow: if user has no addresses, prompt for one
  useEffect(() => {
    if (!isAnonFlow) return;
    if (anonAddressDone) return;
    if (addressesLoading) return;
    if (didAutoOpenAnonAddress) return;
    if (addresses.length > 0) return;

    setDidAutoOpenAnonAddress(true);
    if (isMobile) {
      navigate(`/items/${id}/place_order/anon-address?anon=1`, { replace: true });
      return;
    }

    setAddressDialogMode('anon');
    setAddressFormData({
      address_line_1: '',
      address_line_2: '',
      city: itemOriginCity,
      state: itemOriginState,
      postal_code: '',
      country: itemOriginCountryIso,
      address_type: 'home',
      is_primary: true,
    });
    setAddressDialogOpen(true);
  }, [
    addresses.length,
    addressesLoading,
    anonAddressDone,
    didAutoOpenAnonAddress,
    id,
    isAnonFlow,
    isMobile,
    itemOriginCountryIso,
    itemOriginCity,
    itemOriginState,
    navigate,
  ]);

  // If the item loads after the address dialog opens, default origin fields when still empty
  useEffect(() => {
    if (!addressDialogOpen) return;
    setAddressFormData((prev) => {
      return {
        ...prev,
        country: prev.country || itemOriginCountryIso,
        state: prev.state || itemOriginState,
        city: prev.city || itemOriginCity,
      };
    });
  }, [addressDialogOpen, itemOriginCity, itemOriginCountryIso, itemOriginState]);

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  type ApiErrorResponseData = {
    message?: string;
    error?: string;
    data?: { error?: string };
  };

  const handleSubmit = useCallback(async () => {
    if (!selectedItem || !apiClient || !selectedAddressId) return;

    // Validate phone number if override is enabled
    if (useDifferentPhone && !overridePhoneNumber.trim()) {
      setError(
        t(
          'orders.phoneNumberRequired',
          'Phone number is required when using a different phone number'
        )
      );
      return;
    }

    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      const orderData = {
        items: [
          {
            business_inventory_id: selectedItem.id,
            quantity: quantity,
            ...(selectedVariantId ? { item_variant_id: selectedVariantId } : {}),
          },
        ],
        delivery_address_id: selectedAddressId,
        phone_number: useDifferentPhone ? overridePhoneNumber : undefined,
        special_instructions: specialInstructions.trim() || undefined,
        discount_code: appliedDiscountCode || undefined,
        payment_timing: paymentTiming,
        requires_fast_delivery: requiresFastDelivery,
        delivery_window: deliveryWindow,
      };

      const response = await apiClient.post('/orders', orderData);

      if (!response.data.success) {
        throw new Error(
          response.data.message ||
            t('orders.createOrderFailed', 'Failed to create order')
        );
      }

      const order = response.data.order;
      const unitPrice = listingUnitPricing.unit;
      const contentCategory = metaPixelContentCategoryFromItem(
        selectedItem.item
      );
      const googleCategory = metaPixelGoogleProductCategoryFromItem(
        selectedItem.item
      );
      trackPurchase({
        content_type: 'product',
        content_ids: [selectedItem.id],
        contents: [
          { id: selectedItem.id, quantity, item_price: unitPrice },
        ],
        value: order.total_amount,
        currency: order.currency || selectedItem.item.currency || 'USD',
        content_name: selectedItem.item.name,
        ...(contentCategory && { content_category: contentCategory }),
        ...(googleCategory && { google_product_category: googleCategory }),
      });

      // Navigate to order confirmation page
      navigate('/orders/confirmation', {
        state: {
          order,
        },
      });
    } catch (error: unknown) {
      console.error('Error creating order:', error);

      // Extract error message from API response - check message first, then error, then data.message
      let errorMessage = t(
        'orders.createOrderError',
        'An error occurred while creating your order. Please try again.'
      );

      const apiError = (error as { response?: { data?: ApiErrorResponseData } })
        ?.response?.data;
      if (apiError) {
        errorMessage =
          apiError.message ||
          apiError.error ||
          apiError.data?.error ||
          errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    apiClient,
    appliedDiscountCode,
    deliveryWindow,
    listingUnitPricing.unit,
    navigate,
    paymentTiming,
    quantity,
    requiresFastDelivery,
    specialInstructions,
    selectedAddressId,
    selectedItem,
    selectedVariantId,
    t,
    trackPurchase,
    useDifferentPhone,
    overridePhoneNumber,
  ]);

  const submitWithPhoneGate = useCallback(async () => {
    // Only gate when using profile phone (not override) and it's missing
    const hasProfilePhone = Boolean(profile?.phone_number?.trim());
    if (!useDifferentPhone && !hasProfilePhone) {
      setMissingPhoneError(null);
      setMissingPhoneNumber('');
      setMissingPhoneNationalNumber('');
      const addrCountry = selectedAddress?.country?.trim() || '';
      const locked = !!addrCountry && isCountrySupported(addrCountry);
      const fallbackCountry = locked
        ? addrCountry
        : supportedCountries?.[0] || 'GA';
      setMissingPhoneCountry(fallbackCountry);
      setMissingPhoneDialogOpen(true);
      return;
    }
    await handleSubmit();
  }, [
    handleSubmit,
    isCountrySupported,
    profile?.phone_number,
    selectedAddress?.country,
    supportedCountries,
    useDifferentPhone,
  ]);

  const submitWithEmailGate = useCallback(async () => {
    const hasEmail = Boolean(profile?.email?.trim());
    if (!hasEmail) {
      setMissingEmailDialogOpen(true);
      return;
    }
    await submitWithPhoneGate();
  }, [profile?.email, submitWithPhoneGate]);

  const handleSkipMissingEmail = useCallback(async () => {
    setMissingEmailDialogOpen(false);
    await submitWithPhoneGate();
  }, [submitWithPhoneGate]);

  const handleSavedMissingEmail = useCallback(async () => {
    setMissingEmailDialogOpen(false);
    await refetchProfile();
    await submitWithPhoneGate();
  }, [refetchProfile, submitWithPhoneGate]);

  const handleSubmitWithPhoneGate = useCallback(async () => {
    if (isPayAtDeliveryEligible) {
      setPaymentChoiceDialogOpen(true);
      return;
    }
    await submitWithEmailGate();
  }, [isPayAtDeliveryEligible, submitWithEmailGate]);

  const handleChoosePaymentTimingAndSubmit = useCallback(
    async (timing: 'pay_now' | 'pay_at_delivery') => {
      setPaymentTiming(timing);
      setPaymentChoiceDialogOpen(false);
      await submitWithEmailGate();
    },
    [submitWithEmailGate]
  );

  const openMissingPhoneDialog = useCallback(() => {
    setMissingPhoneError(null);
    setMissingPhoneNumber('');
    setMissingPhoneNationalNumber('');
    const addrCountry = selectedAddress?.country?.trim() || '';
    const locked = !!addrCountry && isCountrySupported(addrCountry);
    const fallbackCountry = locked ? addrCountry : supportedCountries?.[0] || 'GA';
    setMissingPhoneCountry(fallbackCountry);
    setMissingPhoneDialogOpen(true);
  }, [isCountrySupported, selectedAddress?.country, supportedCountries]);

  const handleSaveMissingPhone = useCallback(async () => {
    const dialCode = String(
      countryStateCity?.Country.getCountryByCode(missingPhoneCountry)?.phonecode ||
      ''
    ).replace(/\D/g, '');
    const national = missingPhoneNationalNumber.replace(/\D/g, '').trim();
    const trimmed =
      dialCode && national ? `+${dialCode}${national}` : missingPhoneNumber.trim();

    setMissingPhoneNumber(trimmed);
    if (!trimmed) {
      setMissingPhoneError(
        t(
          'orders.phoneNumberRequiredMessage',
          'Phone number is required for mobile payments.'
        )
      );
      return;
    }

    // Validate supported country using existing helper
    try {
      const parsed = parsePhoneNumber(trimmed);
      const countryCode = parsed?.country || null;
      const supported = countryCode ? isCountrySupported(countryCode) : false;
      if (!supported) {
        setMissingPhoneError(
          t(
            'accounts.withdrawPhoneCmGaOnly',
            'Only Cameroon (+237) or Gabon (+241) phone numbers are accepted.'
          )
        );
        return;
      }
    } catch {
      setMissingPhoneError(
        t('orders.invalidPhoneNumber', 'Invalid phone number format')
      );
      return;
    }

    setMissingPhoneSaving(true);
    setMissingPhoneError(null);
    try {
      await apiClient.post('/users/me/update', {
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        phoneNumber: trimmed,
      });
      await refetchProfile();
      setMissingPhoneDialogOpen(false);
      await handleSubmit();
    } catch (saveErr: unknown) {
      const data = (
        saveErr as { response?: { data?: { error?: string; message?: string } } }
      )?.response?.data;
      const msg =
        data?.error ||
        data?.message ||
        (saveErr instanceof Error ? saveErr.message : null) ||
        t('accounts.withdrawFailed', 'Please try again.');
      setMissingPhoneError(msg);
    } finally {
      setMissingPhoneSaving(false);
    }
  }, [
    apiClient,
    handleSubmit,
    isCountrySupported,
    missingPhoneNumber,
    missingPhoneCountry,
    missingPhoneNationalNumber,
    profile?.first_name,
    profile?.last_name,
    refetchProfile,
    t,
  ]);

  const missingPhoneFullE164 = useMemo(() => {
    const dialCode = String(
      countryStateCity?.Country.getCountryByCode(missingPhoneCountry)?.phonecode ||
      ''
    ).replace(/\D/g, '');
    const national = missingPhoneNationalNumber.replace(/\D/g, '').trim();
    if (!dialCode || !national) return '';
    return `+${dialCode}${national}`;
  }, [missingPhoneCountry, missingPhoneNationalNumber]);

  const missingPhoneValidation = useMemo(() => {
    if (!missingPhoneCountry) {
      return { isValid: false, message: t('orders.selectCountry', 'Select a country.') };
    }
    if (!missingPhoneFullE164) {
      return {
        isValid: false,
        message: t('orders.enterPhoneNumber', 'Enter a phone number.'),
      };
    }
    try {
      const parsed = parsePhoneNumber(missingPhoneFullE164);
      const isValid = !!parsed && parsed.isValid() && parsed.country === missingPhoneCountry;
      return {
        isValid,
        message: isValid
          ? null
          : t('orders.invalidPhoneNumber', 'Invalid phone number format'),
      };
    } catch {
      return {
        isValid: false,
        message: t('orders.invalidPhoneNumber', 'Invalid phone number format'),
      };
    }
  }, [missingPhoneCountry, missingPhoneFullE164, t]);

  const iso2ToFlag = (iso2: string): string => {
    const code = String(iso2 || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return '';
    const A = 0x1f1e6;
    const base = 'A'.charCodeAt(0);
    return String.fromCodePoint(
      A + (code.charCodeAt(0) - base),
      A + (code.charCodeAt(1) - base)
    );
  };

  const handlePageBack = () => {
    navigate(-1);
  };

  const handleCancelPurchase = () => {
    navigate('/items');
  };

  const handleHeaderBackToItems = () => {
    navigate('/items');
  };

  // Address Dialog Handlers
  const handleOpenAddressDialog = useCallback(() => {
    if (selectedAddress) {
      setEditingAddressId(selectedAddress.id);
      setAddressFormData({
        address_line_1: selectedAddress.address_line_1 || '',
        address_line_2: selectedAddress.address_line_2 || '',
        city: selectedAddress.city || '',
        state: selectedAddress.state || '',
        postal_code: selectedAddress.postal_code || '',
        country: selectedAddress.country || '',
        address_type: selectedAddress.address_type || 'home',
        is_primary: Boolean(selectedAddress.is_primary),
        latitude: selectedAddress.latitude,
        longitude: selectedAddress.longitude,
        instructions: selectedAddress.instructions || '',
      });
    } else {
      setEditingAddressId(null);
      setAddressFormData({
        address_line_1: '',
        address_line_2: '',
        city: itemOriginCity,
        state: itemOriginState,
        postal_code: '',
        country: itemOriginCountryIso,
        address_type: 'home',
        is_primary: true,
      });
    }
    setAddressDialogOpen(true);
  }, [
    selectedAddress,
    itemOriginCity,
    itemOriginCountryIso,
    itemOriginState,
  ]);

  const handleCloseAddressDialog = () => {
    setAddressDialogOpen(false);
    setAddressDialogMode('normal');
    setEditingAddressId(null);
    // Reset form data
    setAddressFormData({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      address_type: 'home',
      is_primary: false,
    });
  };

  const handleAddressChange = (address: AddressFormData) => {
    setAddressFormData(address);
  };

  const handleSaveAddress = async () => {
    try {
      // Ensure required fields are set
      const addressData = {
        ...addressFormData,
        address_type:
          addressDialogMode === 'anon'
            ? 'home'
            : addressFormData.address_type || 'home',
        is_primary:
          addressDialogMode === 'anon' ? true : addressFormData.is_primary || false,
      };

      // Update selected address when editing, otherwise add a new one.
      const saveResult = editingAddressId
        ? await updateAddress(editingAddressId, addressData)
        : await addAddress(addressData);

      if (saveResult?.address?.id) {
        setSelectedAddressId(saveResult.address.id);
      }

      // Close the dialog
      handleCloseAddressDialog();

      // Addresses and profile context are refreshed by useAddressManager on success.
      // If this was the first address, it will be automatically selected by the useEffect
    } catch (error) {
      console.error('Error saving address:', error);
      // You might want to show an error message here
    }
  };

  // Validate phone number country - must be before early returns
  const phoneValidation = useMemo(() => {
    const phoneToValidate = useDifferentPhone
      ? overridePhoneNumber
      : profile?.phone_number;

    // If using different phone but no phone number entered yet, don't show error but don't validate
    if (useDifferentPhone && !overridePhoneNumber.trim()) {
      return {
        isValid: false, // Don't allow empty state for button enabling
        countryCode: null,
        message: null,
      };
    }

    if (!phoneToValidate) {
      return {
        isValid: false,
        countryCode: null,
        message: null,
      };
    }

    try {
      const parsedPhone = parsePhoneNumber(phoneToValidate);
      if (!parsedPhone) {
        return {
          isValid: false,
          countryCode: null,
          message: t(
            'orders.invalidPhoneNumber',
            'Invalid phone number format'
          ),
        };
      }

      const countryCode = parsedPhone.country;
      const isSupported = countryCode ? isCountrySupported(countryCode) : false;

      if (!isSupported) {
        return {
          isValid: false,
          countryCode,
          message: t(
            'orders.unsupportedPhoneCountry',
            'Phone number is not from a supported country. Supported countries: {{countries}}',
            { countries: supportedCountries.join(', ') }
          ),
        };
      }

      return {
        isValid: true,
        countryCode,
        message: null,
      };
    } catch {
      return {
        isValid: false,
        countryCode: null,
        message: t('orders.invalidPhoneNumber', 'Invalid phone number format'),
      };
    }
  }, [
    useDifferentPhone,
    overridePhoneNumber,
    profile?.phone_number,
    isCountrySupported,
    supportedCountries,
    t,
  ]);

  // Show loading skeleton
  if (inventoryLoading) {
    return <OrderPageSkeleton />;
  }

  // Show not found message
  if (!selectedItem) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6 }}>
          <Typography variant="h4" gutterBottom color="text.secondary">
            {t('orders.itemNotFound', 'Item not found')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t(
              'orders.itemNotFoundMessage',
              'The item you are looking for is no longer available.'
            )}
          </Typography>
          <Button
            onClick={handlePageBack}
            variant="contained"
            startIcon={<ArrowBack />}
            size="large"
          >
            {t('common.goBack', 'Go Back')}
          </Button>
        </Paper>
      </Container>
    );
  }

  // Calculate if order can be placed
  const hasProfilePhone = Boolean(profile?.phone_number?.trim());
  const variantSelectionValid =
    activeVariants.length < 2 || Boolean(selectedVariantId);
  const baseCanPlaceOrder =
    !loading &&
    !paymentSystemsLoading &&
    selectedAddressId &&
    addresses.length > 0;
  const canPlaceOrder =
    variantSelectionValid &&
    (useDifferentPhone
      ? overridePhoneNumber.trim() !== '' && phoneValidation.isValid
      : !hasProfilePhone || phoneValidation.isValid) &&
    baseCanPlaceOrder;

  // Step validation (mobile wizard). Quantity is chosen on the final review step.
  const isStepValid = (step: number): boolean => {
    if (isMobile) {
      switch (step) {
        case 0: // Delivery Options & Address (merged)
          return !!selectedAddressId && addresses.length > 0;
        case 1: // Review & Place Order (includes quantity)
          return quantity >= 1 && !!canPlaceOrder;
        default:
          return false;
      }
    }
    switch (step) {
      case 0: // Delivery Options
        return true; // Optional fields
      case 1: // Delivery Address
        return !!selectedAddressId && addresses.length > 0;
      case 2: // Review & Place Order (includes quantity)
        return quantity >= 1 && !!canPlaceOrder;
      default:
        return false;
    }
  };

  // Wizard navigation handlers
  const handleNext = () => {
    if (isStepValid(activeStep) && activeStep < steps.length - 1) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prevStep) => prevStep - 1);
    } else {
      navigate(-1);
    }
  };

  const handleStepClick = (step: number) => {
    // Allow jumping to completed steps only
    if (step < activeStep || (step === activeStep + 1 && isStepValid(activeStep))) {
      setActiveStep(step);
    }
  };

  // Render step content for mobile wizard (compact for viewport fit)
  const renderStepContent = (step: number) => {
    // Mobile: 2 steps — 0 = Delivery & Address (merged), 1 = Review & quantity
    if (isMobile && step === 0) {
      return (
        <Stack spacing={2}>
          {/* Delivery Address (merged from former step 3) */}
          {(addressesLoading || addresses.length === 0) && (
            <Card>
              <CardContent sx={{ p: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <LocationOn color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {t('orders.deliveryAddress', 'Delivery Address')}
                  </Typography>
                </Box>

                {addressesLoading ? (
                  <Box
                    sx={{ display: 'flex', justifyContent: 'center', py: 2 }}
                  >
                    <CircularProgress />
                  </Box>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}
                  >
                    <LocationOn
                      sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                    />
                    <Typography variant="subtitle1" gutterBottom>
                      {t('orders.noAddresses', 'No delivery address found')}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {t(
                        'orders.noAddressesMessage',
                        'Please add a delivery address to continue with your order'
                      )}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleOpenAddressDialog}
                      startIcon={<Add />}
                    >
                      {t('orders.addAddress', 'Add Delivery Address')}
                    </Button>
                  </Paper>
                )}
              </CardContent>
            </Card>
          )}

          {/* Delivery Options: fast delivery + time slot (merged from former step 1) */}
          {fastDeliveryConfig &&
            isEnabledForLocation(userCountry, userState) && (
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <FastDeliveryOption
                    config={fastDeliveryConfig}
                    selected={requiresFastDelivery}
                    onToggle={setRequiresFastDelivery}
                    formatCurrency={(amount) =>
                      formatCurrency(amount, selectedItem?.item.currency)
                    }
                  />
                </CardContent>
              </Card>
            )}

          {selectedAddress && (
            <Card sx={{ order: 2 }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {t(
                    'orders.deliveryTimeWindow.availabilityTitle',
                    'When are you available for delivery?'
                  )}
                </Typography>
                <DeliveryTimeWindowSelector
                  countryCode={selectedAddress.country}
                  stateCode={selectedAddress.state}
                  onChange={handleDeliveryWindowChange}
                  isFastDelivery={requiresFastDelivery}
                  loading={loading}
                  shouldFetchNextAvailable={true}
                />
              </CardContent>
            </Card>
          )}
        </Stack>
      );
    }

    if (!(isMobile && step === 1)) {
      return null;
    }

    const mobileUnitPriceCheckout = listingUnitPricing.unit;
    const mobileReviewSubtotal = mobileUnitPriceCheckout * quantity;
    const mobileReviewDelivery = deliveryFee?.deliveryFee || 0;
    const mobileReviewTotalBeforeDiscount =
      mobileReviewSubtotal + mobileReviewDelivery;
    const mobileOrderDiscountAmount =
      appliedDiscountCode && discountPercentage > 0
        ? Number(
            (
              (mobileReviewTotalBeforeDiscount * discountPercentage) /
              100
            ).toFixed(2)
          )
        : 0;
    const mobileOrderGrandTotal = Math.max(
      0,
      mobileReviewTotalBeforeDiscount - mobileOrderDiscountAmount
    );

    return (
      <Stack spacing={2}>
            <Card>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {t('orders.orderSummary', 'Order Summary')}
                </Typography>
                <Divider sx={{ my: 2 }} />

                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {(heroDisplayUrl || orderedSelectedItemImages[0]) && (
                      <ButtonBase
                        onClick={() => openSelectedItemImagePreview(0)}
                        aria-label={t('items.viewAllImages', 'View item images')}
                        sx={{
                          width: 120,
                          height: 120,
                          flexShrink: 0,
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box
                          component="img"
                          src={
                            heroDisplayUrl ||
                            orderedSelectedItemImages[0].image_url
                          }
                          alt={selectedItem.item.name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </ButtonBase>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight="medium" noWrap>
                        {selectedItem.item.name}
                      </Typography>
                      {selectedVariant?.name && (
                        <Typography variant="caption" color="primary" display="block" fontWeight={600}>
                          {selectedVariant.name}
                        </Typography>
                      )}
                      {(selectedItem.item.item_sub_category?.item_category?.name ||
                        selectedItem.item.item_sub_category?.name) && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {[
                            selectedItem.item.item_sub_category?.item_category?.name,
                            selectedItem.item.item_sub_category?.name,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {orderedSelectedItemImages.length > 1 ? (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                      {orderedSelectedItemImages.map((img, idx) => (
                        <ButtonBase
                          key={img.id ?? `${img.image_url}-${idx}`}
                          onClick={() => openSelectedItemImagePreview(idx)}
                          aria-label={t(
                            'items.imageThumbnail',
                            'View image {{index}}',
                            { index: idx + 1 }
                          )}
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor:
                              idx === selectedItemImageIndex ? 'primary.main' : 'divider',
                          }}
                        >
                          <Box
                            component="img"
                            src={img.image_url}
                            alt={img.alt_text || selectedItem.item.name}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                        </ButtonBase>
                      ))}
                    </Stack>
                  ) : null}

                  {selectedItem.item.description?.trim() && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                        {t('items.description', 'Description')}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {selectedItem.item.description}
                      </Typography>
                    </Box>
                  )}

                  <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ pt: 0.5 }}>
                    {specWeightDisplay && (
                      <Typography variant="caption" color="text.secondary">
                        {t('items.weight', 'Weight')}: {specWeightDisplay.value}{' '}
                        {specWeightDisplay.unit || 'g'}
                      </Typography>
                    )}
                    {!!specDimensionsDisplay && (
                      <Typography variant="caption" color="text.secondary">
                        {t('items.dimensions', 'Dimensions')}: {specDimensionsDisplay}
                      </Typography>
                    )}
                    {selectedItem.item.brand?.name && (
                      <Typography variant="caption" color="text.secondary">
                        {t('items.brand', 'Brand')}: {selectedItem.item.brand.name}
                      </Typography>
                    )}
                  </Stack>

                  <VariantSelector
                    variants={activeVariants}
                    value={selectedVariantId}
                    onChange={setSelectedVariantId}
                    listingSellingPrice={selectedItem.selling_price}
                    hasActiveDeal={selectedItem.hasActiveDeal}
                    originalPrice={selectedItem.original_price}
                    discountedPrice={selectedItem.discounted_price}
                    currency={selectedItem.item.currency}
                    disabled={loading}
                    formatCurrency={formatCurrency}
                  />

                  <FormControl fullWidth>
                    <InputLabel id="place-order-review-quantity">
                      {t('orders.quantity', 'Quantity')}
                    </InputLabel>
                    <Select
                      labelId="place-order-review-quantity"
                      value={quantity}
                      label={t('orders.quantity', 'Quantity')}
                      onChange={(e) => setQuantity(e.target.value as number)}
                      disabled={loading}
                    >
                      {Array.from(
                        {
                          length: Math.min(
                            selectedItem.computed_available_quantity,
                            10
                          ),
                        },
                        (_, i) => i + 1
                      ).map((num) => (
                        <MenuItem key={num} value={num}>
                          {num}{' '}
                          {num === 1
                            ? t('orders.unitSingular', 'unit')
                            : t('orders.unitsPlural', 'units')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {deliveryWindow && selectedAddress && (
                    <Paper
                      variant="outlined"
                      sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1.5 }}
                    >
                      {slotsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                          <CircularProgress size={18} />
                        </Box>
                      ) : selectedSlot ? (
                        <Stack spacing={0.75}>
                          <Typography variant="body2" color="text.secondary">
                            <Trans
                              i18nKey="orders.deliveryTimeWindow.reviewSummaryWithEditableAddress"
                              defaults="We will deliver to <address>{{address}}</address> on {{date}} between {{start}} and {{end}}."
                              values={{
                                address: `${selectedAddress.address_line_1}, ${selectedAddress.city}`,
                                date: deliveryReviewDateLabel,
                                start: selectedSlot.start_time,
                                end: selectedSlot.end_time,
                              }}
                              components={{
                                address: (
                                  <ButtonBase
                                    onClick={handleOpenAddressDialog}
                                    sx={{
                                      color: 'primary.main',
                                      fontWeight: 600,
                                      textDecoration: 'underline',
                                      textUnderlineOffset: '2px',
                                      verticalAlign: 'baseline',
                                    }}
                                  />
                                ),
                              }}
                            />
                          </Typography>
                          {deliveryWindow.special_instructions && (
                            <Typography variant="caption" color="text.secondary">
                              {t(
                                'orders.deliveryTimeWindow.specialInstructions',
                                'Special Instructions'
                              )}
                              : {deliveryWindow.special_instructions}
                            </Typography>
                          )}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {t(
                            'orders.deliveryTimeWindow.loading',
                            'Loading delivery slot details...'
                          )}
                        </Typography>
                      )}
                    </Paper>
                  )}

                  <Paper
                    variant="outlined"
                    sx={(theme) => ({
                      p: 1.5,
                      bgcolor: 'background.paper',
                      borderRadius: 1.5,
                      borderColor:
                        theme.palette.mode === 'dark'
                          ? alpha(theme.palette.primary.light, 0.55)
                          : alpha(theme.palette.primary.main, 0.35),
                    })}
                  >
                    <Stack spacing={1}>
                      <Typography variant="body2" fontWeight={600}>
                        {t('orders.specialInstructions', 'Special Instructions')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'orders.specialInstructionsHint',
                          'Add any additional delivery details for the driver (optional).'
                        )}
                      </Typography>
                      <TextField
                        multiline
                        minRows={3}
                        maxRows={5}
                        fullWidth
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        disabled={loading}
                        placeholder={t(
                          'orders.specialInstructionsPlaceholder',
                          'Add any special instructions for this order (optional)'
                        )}
                        inputProps={{ maxLength: 300 }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                        {specialInstructions.length}/300
                      </Typography>
                    </Stack>
                  </Paper>

                  <Box>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.subtotal', 'Subtotal')}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(
                          mobileReviewSubtotal,
                          selectedItem.item.currency
                        )}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.deliveryFee', 'Delivery Fee')}
                      </Typography>
                      <Box
                        sx={{
                          textAlign: 'right',
                          maxWidth: { xs: '100%', sm: 280 },
                          ml: 'auto',
                        }}
                      >
                        {deliveryFeeLoading ? (
                          <CircularProgress size={14} />
                        ) : deliveryAddressMissing ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ lineHeight: 1.45 }}
                          >
                            {t(
                              'orders.deliveryFeeAddressRequired',
                              'Add a delivery address to calculate shipping and complete your order.'
                            )}
                          </Typography>
                        ) : deliveryFeeError ? (
                          <Typography variant="body2" color="error">
                            {t('common.error', 'Error')}
                          </Typography>
                        ) : (() => {
                            const pay = mobileReviewDelivery;
                            const fullBefore =
                              deliveryFee != null
                                ? (Number(deliveryFee.baseDeliveryFeeBeforeDiscount) ||
                                    0) +
                                  (Number(deliveryFee.perKmDeliveryFee) || 0)
                                : 0;
                            if (fullBefore > pay) {
                              return (
                                <>
                                  <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{
                                      textDecoration: 'line-through',
                                      color: 'text.secondary',
                                      mr: 1,
                                    }}
                                  >
                                    {formatCurrency(
                                      fullBefore,
                                      selectedItem.item.currency
                                    )}
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight="medium"
                                    component="span"
                                  >
                                    {formatCurrency(
                                      pay,
                                      selectedItem.item.currency
                                    )}
                                  </Typography>
                                </>
                              );
                            }
                            return (
                              <Typography
                                variant="body2"
                                fontWeight="medium"
                                component="span"
                              >
                                {formatCurrency(
                                  pay,
                                  selectedItem.item.currency
                                )}
                              </Typography>
                            );
                          })()}
                      </Box>
                    </Box>

                    {!deliveryFeeLoading &&
                      !deliveryAddressMissing &&
                      !deliveryFeeError &&
                      (deliveryFee?.firstOrderBaseDeliveryDiscountAmount ?? 0) >
                        0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" color="success.main">
                            {t(
                              'orders.firstDeliveryDiscount',
                              'First delivery discount'
                            )}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="success.main"
                            fontWeight="medium"
                          >
                            −
                            {formatCurrency(
                              deliveryFee?.firstOrderBaseDeliveryDiscountAmount ??
                                0,
                              selectedItem.item.currency
                            )}
                          </Typography>
                        </Box>
                      )}

                    <Box sx={{ mt: 2 }}>
                      <ButtonBase
                        onClick={() => setDiscountDialogOpen(true)}
                        disabled={loading || discountLoading}
                        sx={{
                          color: 'primary.main',
                          fontWeight: 600,
                          textDecoration: 'underline',
                          textUnderlineOffset: '3px',
                          alignSelf: 'flex-start',
                        }}
                      >
                        {appliedDiscountCode
                          ? t(
                              'orders.discountCode.applied',
                              'Applied: {{code}} ({{pct}}% off)',
                              { code: appliedDiscountCode, pct: discountPercentage }
                            )
                          : t(
                              'orders.discountCode.applyCta',
                              'Have a discount code? Apply it'
                            )}
                      </ButtonBase>
                      {discountError && (
                        <Typography variant="caption" color="error" display="block" sx={{ mt: 0.75 }}>
                          {discountError}
                        </Typography>
                      )}
                    </Box>

                    {appliedDiscountCode && discountPercentage > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 1,
                          mt: 1,
                        }}
                      >
                        <Typography variant="body2" color="success.main">
                          {t('orders.discountCode.discount', 'Discount')}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="success.main"
                          fontWeight="medium"
                        >
                          −
                          {formatCurrency(
                            mobileOrderDiscountAmount,
                            selectedItem.item.currency
                          )}
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ my: 1.5 }} />

                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6" fontWeight="bold">
                        {t('orders.total', 'Total')}
                      </Typography>
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        color="primary"
                      >
                        {formatCurrency(
                          mobileOrderGrandTotal,
                          selectedItem.item.currency
                        )}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                  }}
                >
                  <Phone color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {t('orders.paymentInformation', 'Payment Information')}
                  </Typography>
                </Box>

                {!profile?.phone_number ? (
                  <Paper
                    variant="outlined"
                    sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.50' }}
                  >
                    <Phone
                      sx={{ fontSize: 48, color: 'warning.main', mb: 2 }}
                    />
                    <Typography variant="subtitle1" gutterBottom>
                      {t(
                        'orders.phoneNumberRequired',
                        'Phone Number Required'
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {t(
                        'orders.phoneNumberRequiredMessage',
                        'Please add your phone number to receive payment requests'
                      )}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={openMissingPhoneDialog}
                      size="small"
                    >
                      {t('orders.addPhoneNumber', 'Add Phone Number')}
                    </Button>
                  </Paper>
                ) : (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        gutterBottom
                      >
                        {t('orders.mobilePayment', 'Mobile Money Payment')}
                      </Typography>
                      <Typography variant="body2">
                        {t(
                          'orders.paymentRequestMessage',
                          'A payment request will be sent to your registered phone number. Please approve it to complete your order.'
                        )}
                      </Typography>
                    </Alert>

                    <Paper
                      variant="outlined"
                      sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        gutterBottom
                      >
                        {t(
                          'orders.paymentPhoneNumber',
                          'Payment Phone Number'
                        )}
                      </Typography>
                      <Typography variant="body1" fontWeight="bold">
                        {useDifferentPhone
                          ? overridePhoneNumber
                          : profile.phone_number}
                      </Typography>
                    </Paper>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={useDifferentPhone}
                          onChange={(e) =>
                            setUseDifferentPhone(e.target.checked)
                          }
                          disabled={loading}
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {t(
                            'orders.useDifferentPhone',
                            'Use a different phone number'
                          )}
                        </Typography>
                      }
                    />

                    {useDifferentPhone && (
                      <Box sx={{ mt: 2 }}>
                        <PhoneInput
                          value={overridePhoneNumber}
                          onChange={(value) =>
                            setOverridePhoneNumber(value || '')
                          }
                          label={t(
                            'orders.overridePhoneNumber',
                            'Phone Number for Payment'
                          )}
                          defaultCountry="GA"
                          fullWidth
                          onlyCountries={supportedCountries}
                          error={
                            !phoneValidation.isValid &&
                            overridePhoneNumber.trim() !== '' &&
                            phoneValidation.message !== null
                          }
                          helperText={
                            !phoneValidation.isValid &&
                            overridePhoneNumber.trim() !== '' &&
                            phoneValidation.message !== null
                              ? phoneValidation.message || ''
                              : t(
                                  'orders.overridePhoneNote',
                                  'This number will receive the payment request for this order'
                                )
                          }
                        />
                      </Box>
                    )}

                    {phoneValidation.message && !phoneValidation.isValid && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          gutterBottom
                        >
                          {t(
                            'orders.phoneNumberNotSupported',
                            'Phone Number Not Supported'
                          )}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {phoneValidation.message}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {t(
                            'orders.useAlternativePhone',
                            'Please use the "Use a different phone number" option above to enter a phone number from a supported country.'
                          )}
                        </Typography>
                      </Alert>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {error && (
              <Alert severity="error">{error}</Alert>
            )}
          </Stack>
    );
  };

  return (
    <>
      {isMobile ? (
        <Dialog
          fullScreen
          open
          PaperProps={{
            sx: {
              m: 0,
              maxHeight: '100dvh',
              borderRadius: 0,
            },
          }}
        >
          <DialogContent
            sx={{
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100dvh',
              overflow: 'hidden',
            }}
          >
            {/* Compact header */}
            <Box
              sx={{
                flexShrink: 0,
                px: 2,
                pt: 2,
                pb: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Button
                onClick={handleHeaderBackToItems}
                startIcon={<ArrowBack />}
                size="small"
              >
                {t('common.goBack', 'Go Back')}
              </Button>
              <Button
                onClick={handleCancelPurchase}
                size="small"
                color="error"
                sx={{ textTransform: 'none' }}
              >
                {t('orders.cancelPurchase', 'Cancel Purchase')}
              </Button>
            </Box>

            {/* Horizontal stepper - numbers only */}
            <Stepper
              activeStep={activeStep}
              sx={{ flexShrink: 0, py: 1.5, px: 2 }}
            >
              {steps.map((_, index) => (
                <Step key={index}>
                  <StepButton
                    onClick={() => handleStepClick(index)}
                    icon={
                      <StepIconWrapper
                        completed={index < activeStep}
                        active={index === activeStep}
                      >
                        {index + 1}
                      </StepIconWrapper>
                    }
                    sx={{
                      cursor:
                        index <= activeStep ? 'pointer' : 'default',
                    }}
                  />
                </Step>
              ))}
            </Stepper>

            {/* Scrollable step content */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                minHeight: 0,
                px: 2,
                pb: 2,
              }}
            >
              {renderStepContent(activeStep)}
            </Box>

            {/* Fixed bottom nav */}
            <Box
              sx={{
                flexShrink: 0,
                bgcolor: 'background.paper',
                borderTop: 1,
                borderColor: 'divider',
                p: 2,
                boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0))',
              }}
            >
              <Stack direction="row" spacing={2}>
                <Button
                  onClick={handleBack}
                  disabled={activeStep === 0}
                  variant="outlined"
                  fullWidth
                >
                  {t('common.back', 'Back')}
                </Button>
                {activeStep === steps.length - 1 ? (
                  <Button
                    onClick={handleSubmitWithPhoneGate}
                    variant="contained"
                    fullWidth
                    disabled={!isStepValid(activeStep) || loading}
                    startIcon={
                      loading ? <CircularProgress size={20} /> : <ShoppingCart />
                    }
                    sx={getConfirmOrderAttentionSx(
                      isStepValid(activeStep) && !loading
                    )}
                  >
                    {loading
                      ? t('orders.placingOrder', 'Placing Order...')
                      : t('orders.confirmOrder', 'Place order')}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    variant="contained"
                    fullWidth
                    disabled={!isStepValid(activeStep)}
                    sx={getConfirmOrderAttentionSx(isStepValid(activeStep))}
                  >
                    {t('common.next', 'Next')}
                  </Button>
                )}
              </Stack>
            </Box>
          </DialogContent>
        </Dialog>
      ) : (
        <Box
          sx={{
            bgcolor: 'grey.50',
            minHeight: '100vh',
            pb: 4,
          }}
        >
          <Container
            maxWidth="xl"
            sx={{ py: 4, px: { xs: 0, sm: 2 } }}
          >
            {/* Header */}
            <Box sx={{ mb: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  mb: 2,
                }}
              >
                <Button
                  onClick={handlePageBack}
                  startIcon={<ArrowBack />}
                  size="small"
                >
                  {t('common.goBack', 'Go Back')}
                </Button>
                <Button
                  onClick={handleCancelPurchase}
                  size="small"
                  color="error"
                  sx={{ textTransform: 'none' }}
                >
                  {t('orders.cancelPurchase', 'Cancel Purchase')}
                </Button>
              </Box>

              <Typography
                variant="h4"
                component="h1"
                fontWeight="bold"
                gutterBottom
                sx={{ fontSize: '2.5rem' }}
              >
                {t('orders.completeYourOrder', 'Complete Your Order')}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t(
                  'orders.reviewDetails',
                  'Review your order details and confirm your delivery information'
                )}
              </Typography>
            </Box>
          <>
            {/* Desktop Layout - Existing Grid View */}
            {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Order Details */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              {/* Product Card */}
              <Card>
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <ShoppingCart color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.productDetails', 'Product Details')}
                    </Typography>
                  </Box>

                  <Stack spacing={3}>
                    <Box sx={{ width: '100%' }}>
                      {heroDisplayUrl || orderedSelectedItemImages[0] ? (
                        id ? (
                          <ButtonBase
                            component={RouterLink}
                            to={`/items/${id}`}
                            sx={{
                              width: '100%',
                              display: 'block',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                            aria-label={t('items.viewProduct', 'View product')}
                          >
                            <CardMedia
                              component="img"
                              image={
                                heroDisplayUrl ??
                                orderedSelectedItemImages[selectedItemImageIndex]
                                  ?.image_url ??
                                orderedSelectedItemImages[0].image_url
                              }
                              alt={selectedItem.item.name}
                              sx={{
                                width: '100%',
                                height: 'auto',
                                display: 'block',
                                verticalAlign: 'bottom',
                              }}
                            />
                          </ButtonBase>
                        ) : (
                          <CardMedia
                            component="img"
                            image={
                              heroDisplayUrl ??
                              orderedSelectedItemImages[selectedItemImageIndex]
                                ?.image_url ??
                              orderedSelectedItemImages[0].image_url
                            }
                            alt={selectedItem.item.name}
                            sx={{
                              borderRadius: 2,
                              width: '100%',
                              height: 'auto',
                              display: 'block',
                              verticalAlign: 'bottom',
                            }}
                          />
                        )
                      ) : (
                        <Box
                          sx={{
                            borderRadius: 2,
                            width: '100%',
                            minHeight: 200,
                            bgcolor: 'grey.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography color="text.secondary">
                            {t('common.noImage', 'No Image')}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    {orderedSelectedItemImages.length > 1 ? (
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}
                      >
                        {orderedSelectedItemImages.map((img, idx) => {
                          const isSelected = idx === selectedItemImageIndex;
                          return (
                            <ButtonBase
                              key={img.id ?? `${img.image_url}-${idx}`}
                              onClick={() => setSelectedItemImageIndex(idx)}
                              sx={{
                                borderRadius: 1,
                                overflow: 'hidden',
                                border: '2px solid',
                                borderColor: isSelected ? 'primary.main' : 'divider',
                                width: 64,
                                height: 64,
                                flexShrink: 0,
                              }}
                              aria-label={t(
                                'items.imageThumbnail',
                                'View image {{index}}',
                                { index: idx + 1 }
                              )}
                            >
                              <Box
                                component="img"
                                src={img.image_url}
                                alt={img.alt_text || selectedItem.item.name}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                }}
                              />
                            </ButtonBase>
                          );
                        })}
                      </Stack>
                    ) : null}

                    <Box sx={{ width: '100%' }}>
                      <Typography variant="h5" fontWeight="bold" gutterBottom>
                        {selectedItem.item.name}
                      </Typography>

                      {selectedItem.item.brand && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Chip
                            label={selectedItem.item.brand.name}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {selectedItem.item.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          {selectedItem.item.description}
                        </Typography>
                      )}

                      <VariantSelector
                        variants={activeVariants}
                        value={selectedVariantId}
                        onChange={setSelectedVariantId}
                        listingSellingPrice={selectedItem.selling_price}
                        hasActiveDeal={selectedItem.hasActiveDeal}
                        originalPrice={selectedItem.original_price}
                        discountedPrice={selectedItem.discounted_price}
                        currency={selectedItem.item.currency}
                        disabled={loading}
                        formatCurrency={formatCurrency}
                      />

                      {/* Special Handling Tags */}
                      {(selectedItem.item.is_fragile ||
                        selectedItem.item.is_perishable ||
                        selectedItem.item.requires_special_handling) && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{ mb: 2, flexWrap: 'wrap' }}
                        >
                          {selectedItem.item.is_fragile && (
                            <Chip
                              label="Fragile"
                              color="warning"
                              size="small"
                            />
                          )}
                          {selectedItem.item.is_perishable && (
                            <Chip
                              label="Perishable"
                              color="error"
                              size="small"
                            />
                          )}
                          {selectedItem.item.requires_special_handling && (
                            <Chip
                              label="Special Handling"
                              color="info"
                              size="small"
                            />
                          )}
                        </Stack>
                      )}

                      {/* Product Specifications */}
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'grey.50' }}
                      >
                        <Stack spacing={1}>
                          {(selectedVariant?.sku || selectedItem.item.sku) && (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                SKU
                              </Typography>
                              <Typography variant="caption" fontWeight="medium">
                                {selectedVariant?.sku || selectedItem.item.sku}
                              </Typography>
                            </Box>
                          )}
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('orders.availability', 'Availability')}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight="medium"
                              color="success.main"
                            >
                              {selectedItem.computed_available_quantity}{' '}
                              {t('common.inStock', 'in stock')}
                            </Typography>
                          </Box>
                          {(specWeightDisplay != null || !!specDimensionsDisplay) && (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {[
                                  specWeightDisplay != null
                                    ? t('common.weight', 'Weight')
                                    : null,
                                  specDimensionsDisplay
                                    ? t('business.items.dimensions', 'Dimensions')
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Typography>
                              <Typography variant="caption" fontWeight="medium">
                                {[
                                  specWeightDisplay != null
                                    ? `${specWeightDisplay.value} ${specWeightDisplay.unit ?? ''}`.trim()
                                    : null,
                                  specDimensionsDisplay || null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Paper>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Pickup Location Card */}
              {selectedItem.business_location && (
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 3,
                      }}
                    >
                      <LocalShipping color="primary" />
                      <Typography variant="h6" fontWeight="bold">
                        {t('orders.pickupLocation', 'Pickup Location')}
                      </Typography>
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 2,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          {selectedItem.business_location.name}
                        </Typography>
                        {selectedItem.business_location.business
                          .is_verified && (
                          <Chip
                            icon={<Verified />}
                            label={t('common.verified', 'Verified')}
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>

                      {selectedItem.business_location.address && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            {
                              selectedItem.business_location.address
                                .address_line_1
                            }
                            {selectedItem.business_location.address
                              .address_line_2 &&
                              `, ${selectedItem.business_location.address.address_line_2}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedItem.business_location.address.city},{' '}
                            {selectedItem.business_location.address.state}{' '}
                            {selectedItem.business_location.address.postal_code}
                          </Typography>
                          {selectedItem.business_location.address
                            .instructions?.trim() && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              <strong>
                                {t('addresses.howToFind', 'How to find')}:
                              </strong>{' '}
                              {
                                selectedItem.business_location.address
                                  .instructions
                              }
                            </Typography>
                          )}
                        </Stack>
                      )}
                    </Paper>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Address Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <LocationOn color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.deliveryAddress', 'Delivery Address')}
                    </Typography>
                  </Box>

                  {addressesLoading ? (
                    <Box
                      sx={{ display: 'flex', justifyContent: 'center', py: 3 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : addresses.length === 0 ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}
                    >
                      <LocationOn
                        sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                      />
                      <Typography variant="subtitle1" gutterBottom>
                        {t('orders.noAddresses', 'No delivery address found')}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(
                          'orders.noAddressesMessage',
                          'Please add a delivery address to continue with your order'
                        )}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={handleOpenAddressDialog}
                        startIcon={<Add />}
                      >
                        {t('orders.addAddress', 'Add Delivery Address')}
                      </Button>
                    </Paper>
                  ) : (
                    (() => {
                      const selectedAddressWrapper =
                        addresses.find((addr) => addr.address.id === selectedAddressId) ||
                        addresses[0];
                      if (!selectedAddressWrapper) return null;
                      const address = selectedAddressWrapper.address;
                      return (
                        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              mb: 0.5,
                            }}
                          >
                            <CheckCircle color="success" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight="bold">
                              {t('orders.selectedAddress', 'Selected Address')}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
                            {address.address_line_1}
                            {address.address_line_2
                              ? `, ${address.address_line_2}`
                              : ''}
                            {`, ${address.city}`}
                            {address.state ? `, ${address.state}` : ''}
                            {address.postal_code ? ` ${address.postal_code}` : ''}
                          </Typography>
                        </Paper>
                      );
                    })()
                  )}
                </CardContent>
              </Card>

              {/* Fast Delivery Option Card */}
              {fastDeliveryConfig &&
                isEnabledForLocation(userCountry, userState) && (
                  <Card>
                    <CardContent sx={{ p: 3 }}>
                      <FastDeliveryOption
                        config={fastDeliveryConfig}
                        selected={requiresFastDelivery}
                        onToggle={setRequiresFastDelivery}
                        formatCurrency={(amount) =>
                          formatCurrency(amount, selectedItem?.item.currency)
                        }
                      />
                    </CardContent>
                  </Card>
                )}

              {/* Delivery Time Window Selection Card */}
              {selectedAddress && (
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      {t(
                        'orders.deliveryTimeWindow.availabilityTitle',
                        'When are you available for delivery?'
                      )}
                    </Typography>
                    <DeliveryTimeWindowSelector
                      countryCode={selectedAddress.country}
                      stateCode={selectedAddress.state}
                      onChange={handleDeliveryWindowChange}
                      isFastDelivery={requiresFastDelivery}
                      loading={loading}
                      shouldFetchNextAvailable={true}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Payment Information Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <Phone color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.paymentInformation', 'Payment Information')}
                    </Typography>
                  </Box>

                  {!profile?.phone_number ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.50' }}
                    >
                      <Phone
                        sx={{ fontSize: 48, color: 'warning.main', mb: 2 }}
                      />
                      <Typography variant="subtitle1" gutterBottom>
                        {t(
                          'orders.phoneNumberRequired',
                          'Phone Number Required'
                        )}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(
                          'orders.phoneNumberRequiredMessage',
                          'Please add your phone number to receive payment requests'
                        )}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={openMissingPhoneDialog}
                        size="small"
                      >
                        {t('orders.addPhoneNumber', 'Add Phone Number')}
                      </Button>
                    </Paper>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          gutterBottom
                        >
                          {t('orders.mobilePayment', 'Mobile Money Payment')}
                        </Typography>
                        <Typography variant="body2">
                          {paymentTiming === 'pay_at_delivery'
                            ? t(
                                'orders.payAtDelivery.info',
                                'You will pay at delivery in the app when the agent arrives. Please keep your phone available to approve the payment request.'
                              )
                            : t(
                                'orders.paymentRequestMessage',
                                'A payment request will be sent to your registered phone number. Please approve it to complete your order.'
                              )}
                        </Typography>
                      </Alert>

                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          {t(
                            'orders.paymentPhoneNumber',
                            'Payment Phone Number'
                          )}
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {useDifferentPhone
                            ? overridePhoneNumber
                            : profile.phone_number}
                        </Typography>
                      </Paper>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={useDifferentPhone}
                            onChange={(e) =>
                              setUseDifferentPhone(e.target.checked)
                            }
                            disabled={loading}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            {t(
                              'orders.useDifferentPhone',
                              'Use a different phone number'
                            )}
                          </Typography>
                        }
                      />

                      {useDifferentPhone && (
                        <Box sx={{ mt: 2 }}>
                          <PhoneInput
                            value={overridePhoneNumber}
                            onChange={(value) =>
                              setOverridePhoneNumber(value || '')
                            }
                            label={t(
                              'orders.overridePhoneNumber',
                              'Phone Number for Payment'
                            )}
                            defaultCountry="GA"
                            fullWidth
                            onlyCountries={supportedCountries}
                            error={
                              !phoneValidation.isValid &&
                              overridePhoneNumber.trim() !== '' &&
                              phoneValidation.message !== null
                            }
                            helperText={
                              !phoneValidation.isValid &&
                              overridePhoneNumber.trim() !== '' &&
                              phoneValidation.message !== null
                                ? phoneValidation.message || ''
                                : t(
                                    'orders.overridePhoneNote',
                                    'This number will receive the payment request for this order'
                                  )
                            }
                          />
                        </Box>
                      )}

                      {/* Phone Number Country Validation Warning */}
                      {phoneValidation.message && !phoneValidation.isValid && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            gutterBottom
                          >
                            {t(
                              'orders.phoneNumberNotSupported',
                              'Phone Number Not Supported'
                            )}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 2 }}>
                            {phoneValidation.message}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {t(
                              'orders.useAlternativePhone',
                              'Please use the "Use a different phone number" option above to enter a phone number from a supported country.'
                            )}
                          </Typography>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Column - Order Summary (Desktop Sticky) */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <OrderSummary
              selectedItem={selectedItem}
              resolvedPricing={{
                unit: listingUnitPricing.unit,
                strikeOriginal: listingUnitPricing.strikeOriginal,
                hasDeal: listingUnitPricing.hasDeal,
              }}
              displayImageSrc={variantPrimaryImageUrl}
              variantLabel={selectedVariant?.name ?? null}
              quantity={quantity}
              onQuantityChange={setQuantity}
              maxOrderQuantity={Math.min(
                selectedItem.computed_available_quantity,
                10
              )}
              deliveryFee={deliveryFee?.deliveryFee || null}
              deliveryFeeLoading={deliveryFeeLoading}
              deliveryFeeError={deliveryFeeError}
              deliveryAddressMissing={deliveryAddressMissing}
              firstOrderBaseDeliveryDiscountAmount={
                deliveryFee?.firstOrderBaseDeliveryDiscountAmount
              }
              deliveryFeeFullBeforeDiscount={
                deliveryFee != null
                  ? (Number(deliveryFee.baseDeliveryFeeBeforeDiscount) || 0) +
                    (Number(deliveryFee.perKmDeliveryFee) || 0)
                  : undefined
              }
              requiresFastDelivery={requiresFastDelivery}
              formatCurrency={formatCurrency}
              discountCodeDraft={discountCodeDraft}
              onDiscountCodeDraftChange={setDiscountCodeDraft}
              onApplyDiscountCode={() => void applyDiscountCode(discountCodeDraft)}
              onClearDiscountCode={() => {
                clearDiscountCode();
                setDiscountCodeDraft('');
              }}
              appliedDiscountCode={appliedDiscountCode}
              discountPercentage={discountPercentage}
              discountLoading={discountLoading}
              discountError={discountError}
              onSubmit={handleSubmitWithPhoneGate}
              loading={loading}
              disabled={!canPlaceOrder}
              isMobile={isMobile}
              error={error}
            />
          </Grid>
        </Grid>
          </>
          </Container>
        </Box>
      )}

      {/* Address Dialog */}
      <Dialog
        open={paymentChoiceDialogOpen}
        onClose={() => setPaymentChoiceDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('orders.paymentTiming.label', 'When do you want to pay?')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'orders.paymentTiming.choosePrompt',
              'Choose how you want to pay for this order.'
            )}
          </Typography>

          <Stack spacing={1.25}>
            <ButtonBase
              onClick={() => setPaymentTiming('pay_now')}
              disabled={loading}
              sx={{ width: '100%', textAlign: 'left', borderRadius: 2 }}
            >
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  p: 1.5,
                  borderRadius: 2,
                  borderColor:
                    paymentTiming === 'pay_now' ? 'primary.main' : 'divider',
                  bgcolor:
                    paymentTiming === 'pay_now' ? 'primary.50' : 'background.paper',
                  transition: 'all 0.15s ease',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      flexShrink: 0,
                    }}
                  >
                    <PaymentsOutlined fontSize="small" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700}>
                      {t('orders.paymentTiming.payNow', 'Pay now')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {t(
                        'orders.paymentTiming.payNowShort',
                        'Approve the payment request right away.'
                      )}
                    </Typography>
                  </Box>
                  {paymentTiming === 'pay_now' ? (
                    <CheckCircle color="primary" />
                  ) : null}
                </Stack>
              </Paper>
            </ButtonBase>

            <ButtonBase
              onClick={() => setPaymentTiming('pay_at_delivery')}
              disabled={loading}
              sx={{ width: '100%', textAlign: 'left', borderRadius: 2 }}
            >
              <Paper
                variant="outlined"
                sx={{
                  width: '100%',
                  p: 1.5,
                  borderRadius: 2,
                  borderColor:
                    paymentTiming === 'pay_at_delivery'
                      ? 'primary.main'
                      : 'divider',
                  bgcolor:
                    paymentTiming === 'pay_at_delivery'
                      ? 'primary.50'
                      : 'background.paper',
                  transition: 'all 0.15s ease',
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: 'secondary.main',
                      color: 'secondary.contrastText',
                      flexShrink: 0,
                    }}
                  >
                    <ScheduleOutlined fontSize="small" />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700}>
                      {t(
                        'orders.paymentTiming.payAtDelivery',
                        'Pay at delivery'
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {t(
                        'orders.paymentTiming.payAtDeliveryShort',
                        'Pay in the app when the agent arrives.'
                      )}
                    </Typography>
                  </Box>
                  {paymentTiming === 'pay_at_delivery' ? (
                    <CheckCircle color="primary" />
                  ) : null}
                </Stack>
              </Paper>
            </ButtonBase>
          </Stack>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700} gutterBottom>
              {paymentTiming === 'pay_now'
                ? t('orders.paymentTiming.payNow', 'Pay now')
                : t(
                    'orders.paymentTiming.payAtDelivery',
                    'Pay at delivery'
                  )}
            </Typography>
            <Typography variant="body2">
              {paymentTiming === 'pay_now'
                ? t(
                    'orders.paymentTiming.payNowDescription',
                    'We’ll send a payment request to your phone now. Approve it to place your order.'
                  )
                : t(
                    'orders.paymentTiming.payAtDeliveryDescription',
                    'You will place the order now and pay at delivery in the app when the agent arrives.'
                  )}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => handleChoosePaymentTimingAndSubmit(paymentTiming)}
            disabled={loading}
          >
            {paymentTiming === 'pay_now'
              ? t('orders.paymentTiming.payNow', 'Pay now')
              : t(
                  'orders.paymentTiming.payAtDelivery',
                  'Pay at delivery'
                )}
          </Button>
          <Button
            onClick={() => setPaymentChoiceDialogOpen(false)}
            disabled={loading}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={discountDialogOpen}
        onClose={() => setDiscountDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('orders.discountCode.label', 'Discount code')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t(
              'orders.discountCode.help',
              'Enter a discount code to apply it to this order.'
            )}
          </Typography>
          <Stack spacing={1.25}>
            <TextField
              label={t('orders.discountCode.label', 'Discount code')}
              value={discountCodeDraft}
              onChange={(e) => setDiscountCodeDraft(e.target.value)}
              disabled={discountLoading || loading}
              placeholder={t('orders.discountCode.placeholder', 'Enter code')}
              error={!!discountError}
              helperText={discountError || ' '}
              fullWidth
            />
            <Stack direction="row" spacing={1}>
              {appliedDiscountCode ? (
                <Button
                  variant="outlined"
                  onClick={() => {
                    clearDiscountCode();
                    setDiscountCodeDraft('');
                  }}
                  disabled={discountLoading || loading}
                  fullWidth
                >
                  {t('common.clear', 'Clear')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={async () => {
                    const res = await applyDiscountCode(discountCodeDraft);
                    if (res.valid) setDiscountDialogOpen(false);
                  }}
                  disabled={!discountCodeDraft.trim() || discountLoading || loading}
                  fullWidth
                  startIcon={
                    discountLoading ? <CircularProgress size={18} /> : undefined
                  }
                >
                  {t('orders.discountCode.apply', 'Apply')}
                </Button>
              )}
              <Button
                variant="text"
                onClick={() => setDiscountDialogOpen(false)}
                disabled={discountLoading}
              >
                {t('common.close', 'Close')}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </Dialog>

      <MissingEmailDialog
        open={missingEmailDialogOpen}
        onSkip={() => void handleSkipMissingEmail()}
        onSaved={() => void handleSavedMissingEmail()}
      />

      <AddressDialog
        open={addressDialogOpen}
        title={
          addressDialogMode === 'anon'
            ? t('orders.addDeliveryAddress', 'Add Delivery Address')
            : t('orders.addDeliveryAddress', 'Add Delivery Address')
        }
        subtitle={
          addressDialogMode === 'anon'
            ? t(
                'orders.anonDeliveryAddressPrompt',
                'Where do you want this item delivered?'
              )
            : undefined
        }
        addressData={addressFormData}
        loading={loading}
        showAddressType={addressDialogMode !== 'anon'}
        showIsPrimary={addressDialogMode !== 'anon'}
        hideAddressLine2={true}
        hidePostalCode={addressDialogMode === 'anon'}
        showCoordinates={false}
        fullScreen={isMobile}
        recommendCurrentLocation={addressDialogMode === 'anon'}
        onClose={handleCloseAddressDialog}
        onSave={handleSaveAddress}
        onAddressChange={handleAddressChange}
      />

      <Dialog
        open={missingPhoneDialogOpen}
        onClose={() => {
          if (!missingPhoneSaving) setMissingPhoneDialogOpen(false);
        }}
        fullWidth
        maxWidth="xs"
        fullScreen={isMobile}
        slotProps={{ paper: { sx: { borderRadius: 0 } } }}
      >
        <DialogTitle>
          {t(
            'orders.phoneNumberRequiredMessage',
            'Phone number is required for mobile payments.'
          )}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t(
                'orders.phoneNumberNeededForOrder',
                'Please add a phone number to complete your order.'
              )}
            </Typography>

            {missingPhoneError && <Alert severity="error">{missingPhoneError}</Alert>}

            {missingPhoneCountry === 'CM' ? <CmAcceptedPaymentLogos compact /> : null}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' },
                gap: 1.5,
                alignItems: 'start',
              }}
            >
              <FormControl fullWidth size="small">
                <InputLabel id="missing-phone-country">
                  {t('common.country', 'Country')}
                </InputLabel>
                <Select
                  labelId="missing-phone-country"
                  label={t('common.country', 'Country')}
                  value={missingPhoneCountry || ''}
                  onChange={(e) => {
                    const next = String(e.target.value || '');
                    setMissingPhoneCountry(next);
                    setMissingPhoneNationalNumber('');
                    setMissingPhoneNumber('');
                  }}
                  disabled={
                    !!selectedAddress?.country?.trim() &&
                    isCountrySupported(selectedAddress.country.trim())
                  }
                >
                  {supportedCountries.map((iso2) => {
                    const c = countryStateCity?.Country.getCountryByCode(iso2);
                    const code = c?.phonecode ? `+${c.phonecode}` : '';
                    return (
                      <MenuItem key={iso2} value={iso2}>
                        {iso2ToFlag(iso2)} {code}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              <TextField
                label={t('accounts.phoneNumber', 'Phone Number')}
                value={missingPhoneNationalNumber}
                onChange={(e) => {
                  const digits = String(e.target.value || '').replace(/\D/g, '');
                  setMissingPhoneNationalNumber(digits);
                  const dial = String(
                    countryStateCity?.Country.getCountryByCode(missingPhoneCountry)?.phonecode ||
      ''
                  ).replace(/\D/g, '');
                  setMissingPhoneNumber(dial ? `+${dial}${digits}` : digits);
                }}
                inputProps={{ inputMode: 'numeric' }}
                placeholder={t('orders.phoneNumberPlaceholder', 'e.g. 6XXXXXXXX')}
                error={!!missingPhoneNationalNumber && !missingPhoneValidation.isValid}
                helperText={
                  missingPhoneNationalNumber && !missingPhoneValidation.isValid
                    ? missingPhoneValidation.message
                    : t(
                        'orders.phoneNumberDialCodeHint',
                        'The country code is added automatically.'
                      )
                }
                size="small"
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setMissingPhoneDialogOpen(false)}
            disabled={missingPhoneSaving}
            sx={{ borderRadius: 0 }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveMissingPhone}
            disabled={missingPhoneSaving || !missingPhoneValidation.isValid}
            sx={{ borderRadius: 0 }}
            startIcon={
              missingPhoneSaving ? <CircularProgress size={18} /> : <Phone />
            }
          >
            {missingPhoneSaving
              ? t('common.saving', 'Saving...')
              : t('common.continue', 'Continue')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={itemImagePreviewOpen}
        onClose={closeSelectedItemImagePreview}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
      >
        <DialogTitle>{selectedItem?.item?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {orderedSelectedItemImages[0] ? (
              <Box
                sx={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: 1.5,
                  p: 1,
                }}
              >
                <Box
                  component="img"
                  src={
                    heroDisplayUrl ??
                    orderedSelectedItemImages[selectedItemImageIndex]?.image_url ??
                    orderedSelectedItemImages[0].image_url
                  }
                  alt={selectedItem?.item?.name}
                  sx={{
                    width: '100%',
                    maxHeight: isMobile ? '60vh' : '70vh',
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: 1,
                  }}
                />
              </Box>
            ) : null}

            {orderedSelectedItemImages.length > 1 ? (
              <>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Button onClick={showPreviousPreviewImage}>
                    {t('common.previous', 'Previous')}
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    {t('items.imageCount', 'Image {{current}} of {{total}}', {
                      current: selectedItemImageIndex + 1,
                      total: orderedSelectedItemImages.length,
                    })}
                  </Typography>
                  <Button onClick={showNextPreviewImage}>
                    {t('common.next', 'Next')}
                  </Button>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                  {orderedSelectedItemImages.map((img, idx) => {
                    const isSelected = idx === selectedItemImageIndex;
                    return (
                      <ButtonBase
                        key={img.id ?? `${img.image_url}-${idx}-preview`}
                        onClick={() => setSelectedItemImageIndex(idx)}
                        aria-label={t(
                          'items.imageThumbnail',
                          'View image {{index}}',
                          { index: idx + 1 }
                        )}
                        sx={{
                          width: 60,
                          height: 60,
                          flexShrink: 0,
                          borderRadius: 1,
                          overflow: 'hidden',
                          border: '2px solid',
                          borderColor: isSelected ? 'primary.main' : 'divider',
                        }}
                      >
                        <Box
                          component="img"
                          src={img.image_url}
                          alt={img.alt_text || selectedItem.item.name}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          }}
                        />
                      </ButtonBase>
                    );
                  })}
                </Stack>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSelectedItemImagePreview}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Placing order overlay with animation */}
      <PlacingOrderOverlay open={loading} />
    </>
  );
};

export default PlaceOrderPage;
