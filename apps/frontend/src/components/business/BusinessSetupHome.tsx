import {
  CheckCircleOutline,
  RadioButtonUnchecked,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { BusinessVerificationStatus } from '../../hooks/useBusinessVerification';
import {
  firstItemOnboardingPath,
  isStorePreviewDone,
  markStorePreviewDone,
} from '../../utils/businessSetup';
import {
  SetupAgreementIllustration,
  SetupCatalogIllustration,
  SetupIdentityIllustration,
  SetupMobileMoneyIllustration,
  SetupPayoutsIllustration,
} from '../illustrations/BusinessSetupIllustrations';
import StripeConnectOnboardingCard from './StripeConnectOnboardingCard';

export interface BusinessSetupHomeProps {
  status: BusinessVerificationStatus;
  mainInterest: 'sell_items' | 'rent_items';
  businessId?: string;
  /** Soft catalog progress when the MM rail omits steps.catalog. */
  hasAnyItem?: boolean;
  onRefresh?: () => Promise<void> | void;
}

type SetupStepId =
  | 'agreement'
  | 'payouts'
  | 'identity'
  | 'mobileMoney'
  | 'catalog'
  | 'previewStore';

type SetupStep = {
  id: SetupStepId;
  label: string;
  description: string;
  done: boolean;
  current: boolean;
  to?: string;
  cta?: string;
  embedStripe?: boolean;
  pendingNote?: string;
};

export const BusinessSetupHome: React.FC<BusinessSetupHomeProps> = ({
  status,
  mainInterest,
  businessId,
  hasAnyItem = false,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [previewDone, setPreviewDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const isStripe = status.paymentRail === 'stripe';
  const catalog = status.steps.catalog;
  const hasCatalogItem =
    hasAnyItem ||
    Boolean(
      catalog?.hasApprovedItem ||
        catalog?.hasPendingItem ||
        catalog?.hasApprovedRental ||
        catalog?.hasPendingRental
    );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!businessId) {
      setPreviewDone(false);
      return;
    }
    setPreviewDone(isStorePreviewDone(businessId));
  }, [businessId]);

  const steps = useMemo(
    () =>
      buildSetupSteps({
        status,
        isStripe,
        mainInterest,
        businessId,
        previewDone,
        hasCatalogItem,
        t,
      }),
    [
      status,
      isStripe,
      mainInterest,
      businessId,
      previewDone,
      hasCatalogItem,
      t,
    ]
  );

  const current = steps.find((s) => s.current && !s.done) ?? steps.find((s) => !s.done);

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: 2,
        border: 1,
        borderColor: 'primary.light',
      }}
    >
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ mb: 2 }}
        >
          {current ? <StepIllustration stepId={current.id} /> : null}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" gutterBottom>
              {t('business.setup.title', 'Set up your store')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'business.setup.subtitle',
                'Complete these steps to go live and accept orders. Operational tools like orders appear after setup.'
              )}
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={1.5}>
          {steps.map((step) => (
            <SetupStepRow
              key={step.id}
              step={step}
              onPreviewClick={() => {
                if (step.id !== 'previewStore' || !businessId) return;
                markStorePreviewDone(businessId);
                setPreviewDone(true);
              }}
            />
          ))}
        </Stack>

        {current?.embedStripe ? (
          <Box sx={{ mt: 2 }}>
            <StripeConnectOnboardingCard />
          </Box>
        ) : null}

        {current?.pendingNote ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {current.pendingNote}
          </Typography>
        ) : null}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
          {current?.to && current.cta && !current.embedStripe ? (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                if (current.id === 'previewStore' && businessId) {
                  markStorePreviewDone(businessId);
                  setPreviewDone(true);
                }
                navigate(current.to!);
              }}
            >
              {current.cta}
            </Button>
          ) : null}
          {onRefresh ? (
            <Button
              variant="outlined"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
            >
              {t('common.refresh', 'Refresh')}
            </Button>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

function StepIllustration({ stepId }: { stepId: SetupStepId }) {
  const { t } = useTranslation();
  const label = t('business.setup.illustrationLabel', 'Setup step');
  if (stepId === 'agreement') {
    return <SetupAgreementIllustration label={label} />;
  }
  if (stepId === 'payouts') {
    return <SetupPayoutsIllustration label={label} />;
  }
  if (stepId === 'identity') {
    return <SetupIdentityIllustration label={label} />;
  }
  if (stepId === 'mobileMoney') {
    return <SetupMobileMoneyIllustration label={label} />;
  }
  return <SetupCatalogIllustration label={label} />;
}

function SetupStepRow({
  step,
  onPreviewClick,
}: {
  step: SetupStep;
  onPreviewClick: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 2,
        p: 1.5,
        borderRadius: 1,
        bgcolor: step.current && !step.done ? 'action.hover' : 'transparent',
        border: 1,
        borderColor: step.current && !step.done ? 'primary.light' : 'divider',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, flex: 1, minWidth: 0 }}>
        {step.done ? (
          <CheckCircleOutline color="success" fontSize="small" sx={{ mt: 0.25 }} />
        ) : (
          <RadioButtonUnchecked
            color={step.current ? 'primary' : 'disabled'}
            fontSize="small"
            sx={{ mt: 0.25 }}
          />
        )}
        <Box>
          <Typography
            variant="subtitle2"
            color={step.done ? 'text.secondary' : 'text.primary'}
            sx={{ textDecoration: step.done ? 'line-through' : 'none' }}
          >
            {step.label}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step.description}
          </Typography>
        </Box>
      </Box>
      {!step.done && step.to && step.cta && !step.embedStripe ? (
        <Button
          component={RouterLink}
          to={step.to}
          size="small"
          variant={step.current ? 'contained' : 'outlined'}
          onClick={onPreviewClick}
          sx={{ flexShrink: 0 }}
        >
          {step.cta}
        </Button>
      ) : null}
    </Box>
  );
}

type BuildParams = {
  status: BusinessVerificationStatus;
  isStripe: boolean;
  mainInterest: 'sell_items' | 'rent_items';
  businessId?: string;
  previewDone: boolean;
  hasCatalogItem: boolean;
  t: (key: string, defaultValue: string) => string;
};

function buildAgreementStep(params: BuildParams): SetupStep {
  const { status, t } = params;
  return {
    id: 'agreement',
    label: t('business.setup.stepAgreement', 'Sign merchant agreement'),
    description: t(
      'business.setup.stepAgreementDesc',
      'Accept the partnership terms to sell on Rendasua.'
    ),
    done: status.steps.agreement?.complete === true,
    current: status.nextAction === 'sign_agreement',
    to: '/business/merchant-agreement',
    cta: status.contract?.boldSignEnabled
      ? t('business.contract.viewStatus', 'View signing status')
      : t('business.setup.ctaAgreement', 'Sign agreement'),
  };
}

function buildStripeRailSteps(params: BuildParams): SetupStep[] {
  const { status, mainInterest, t } = params;
  const next = status.nextAction;
  const catalogPending = Boolean(
    status.steps.catalog?.hasPendingItem || status.steps.catalog?.hasPendingRental
  );
  return [
    {
      id: 'payouts',
      label: t('business.setup.stepPayouts', 'Connect payouts'),
      description: t(
        'business.setup.stepPayoutsDesc',
        'Link Stripe so you can receive customer payments.'
      ),
      done: status.steps.stripeConnect?.complete === true,
      current: next === 'setup_stripe_connect',
      embedStripe: next === 'setup_stripe_connect',
    },
    {
      id: 'catalog',
      label: t('business.setup.stepCatalog', 'Add your first product'),
      description: t(
        'business.setup.stepCatalogDesc',
        'Publish an approved product or rental to open your storefront.'
      ),
      done: status.steps.catalog?.complete === true,
      current: next === 'publish_catalog',
      to: catalogPending ? undefined : firstItemOnboardingPath(mainInterest),
      cta: catalogPending
        ? undefined
        : t('business.setup.ctaCatalog', 'Add product'),
      pendingNote: catalogPending
        ? t(
            'business.verification.catalogPendingNotice',
            'Your product is awaiting review. Once approved, this step will complete.'
          )
        : undefined,
    },
  ];
}

function buildMobileMoneyRailSteps(params: BuildParams): SetupStep[] {
  const { status, mainInterest, hasCatalogItem, t } = params;
  const next = status.nextAction;
  const requiredDone =
    status.steps.agreement?.complete === true &&
    status.steps.identity?.complete === true &&
    status.steps.mobilePaymentPhone?.complete === true;
  return [
    {
      id: 'identity',
      label: t('business.setup.stepIdentity', 'Upload identification'),
      description: t(
        'business.setup.stepIdentityDesc',
        "Upload a national ID, passport, or driver's license."
      ),
      done: status.steps.identity?.complete === true,
      current: next === 'upload_id',
      to: '/documents',
      cta: t('business.setup.ctaIdentity', 'Upload ID'),
    },
    {
      id: 'mobileMoney',
      label: t('business.setup.stepMobileMoney', 'Verify mobile money number'),
      description: t(
        'business.setup.stepMobileMoneyDesc',
        'Add and verify a payout number for your locations.'
      ),
      done: status.steps.mobilePaymentPhone?.complete === true,
      current: next === 'verify_mobile_payment_phone',
      to: '/business/locations',
      cta: t('mobilePaymentPhone.verifyCta', 'Verify mobile money number'),
    },
    {
      id: 'catalog',
      label: t('business.setup.stepCatalog', 'Add your first product'),
      description: t(
        'business.setup.stepCatalogDesc',
        'Publish an approved product or rental to open your storefront.'
      ),
      done: hasCatalogItem,
      // Soft guidance — MM nextAction never becomes publish_catalog.
      current: requiredDone && !hasCatalogItem,
      to: firstItemOnboardingPath(mainInterest),
      cta: t('business.setup.ctaCatalog', 'Add product'),
    },
  ];
}

function buildSetupSteps(params: BuildParams): SetupStep[] {
  const steps: SetupStep[] = [buildAgreementStep(params)];
  if (params.isStripe) {
    steps.push(...buildStripeRailSteps(params));
  } else {
    steps.push(...buildMobileMoneyRailSteps(params));
  }
  if (params.businessId && params.hasCatalogItem) {
    steps.push({
      id: 'previewStore',
      label: params.t('business.setup.stepPreview', 'Preview your store'),
      description: params.t(
        'business.setup.stepPreviewDesc',
        'See how customers will discover your products.'
      ),
      done: params.previewDone,
      current: false,
      to: `/store/${params.businessId}?preview=1`,
      cta: params.t('stores.previewCtaButton', 'Preview store'),
    });
  }
  return steps;
}
