import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessAccountType } from '../../hooks/useBusinessAccountType';
import {
  getPlanById,
  type BusinessAccountTypeId,
  type BusinessAccountTypePlan,
} from '../../constants/businessAccountTypes';
import { AccountTypeTiersIllustration } from '../illustrations/AccountTypeTiersIllustration';
import SEOHead from '../seo/SEOHead';

const BusinessAccountTypePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    accountType,
    plan: currentPlan,
    plans,
    isLocked,
    lockedMessage,
    loading,
    changeAccountType,
  } = useBusinessAccountType();

  const [selectedType, setSelectedType] = useState<BusinessAccountTypeId | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const handleSelect = (id: BusinessAccountTypeId) => {
    if (id === accountType) return;
    setSelectedType(id);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedType) return;
    setChanging(true);
    setChangeError(null);
    try {
      await changeAccountType(selectedType);
      setConfirmOpen(false);
      setSelectedType(null);
    } catch (err: any) {
      setChangeError(
        err?.message || t('business.accountType.changeFailed', 'Failed to change plan')
      );
    } finally {
      setChanging(false);
    }
  };

  const selectedPlan = selectedType
    ? plans.find((p) => p.id === selectedType) ?? getPlanById(selectedType)
    : null;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <SEOHead
        title={t('business.accountType.pageTitle', 'Account & Plan')}
        description={t(
          'business.accountType.pageDescription',
          'Choose the right plan for your business on Rendasua.'
        )}
      />

      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        {t('common.back', 'Back')}
      </Button>

      <Box display="flex" alignItems="center" gap={3} mb={4} flexWrap="wrap">
        <AccountTypeTiersIllustration width={140} height={120} />
        <Box flex={1} minWidth={240}>
          <Typography variant="h4" fontWeight={700}>
            {t('business.accountType.pageHeading', 'Choose Your Business Plan')}
          </Typography>
          <Typography variant="body1" color="text.secondary" mt={0.5}>
            {t(
              'business.accountType.pageSubheading',
              'Every business starts on Standard for free and can upgrade anytime as it grows. A higher tier means more visibility and benefits — and a higher commission rate.'
            )}
          </Typography>
        </Box>
      </Box>

      {isLocked && lockedMessage ? (
        <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 3 }}>
          {lockedMessage}
        </Alert>
      ) : null}

      {changeError ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {changeError}
        </Alert>
      ) : null}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          display="grid"
          gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }}
          gap={2.5}
          alignItems="stretch"
        >
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={plan.id === accountType}
              isLocked={isLocked}
              onSelect={handleSelect}
            />
          ))}
        </Box>
      )}

      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        mt={4}
        textAlign="center"
      >
        {t(
          'business.accountType.lockInNote',
          'After changing your plan, a 30-day commitment period begins. You can change again after that period ends.'
        )}
      </Typography>

      {confirmOpen && selectedPlan ? (
        <Dialog
          open={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedType(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <Box sx={{ borderTop: `4px solid ${selectedPlan.color}` }} />
          <DialogTitle>
            {t('business.accountType.confirmTitle', 'Change to {{plan}}?', {
              plan: t(selectedPlan.labelKey, selectedPlan.defaultLabel),
            })}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              {t(
                'business.accountType.confirmMessage',
                'You are switching from {{from}} ({{fromPct}}% commission) to {{to}} ({{toPct}}% commission). This plan will be locked for 30 days after confirming.',
                {
                  from: t(currentPlan.labelKey, currentPlan.defaultLabel),
                  fromPct: currentPlan.commissionPercent,
                  to: t(selectedPlan.labelKey, selectedPlan.defaultLabel),
                  toPct: selectedPlan.commissionPercent,
                }
              )}
            </Typography>
            {changeError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {changeError}
              </Alert>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setSelectedType(null);
              }}
              disabled={changing}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={changing}
              sx={{
                bgcolor: selectedPlan.color,
                '&:hover': { bgcolor: selectedPlan.color, filter: 'brightness(0.92)' },
              }}
            >
              {changing ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                t('business.accountType.confirmChangeBtn', 'Confirm Change')
              )}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Container>
  );
};

function PlanCard({
  plan,
  isCurrent,
  isLocked,
  onSelect,
}: {
  plan: BusinessAccountTypePlan;
  isCurrent: boolean;
  isLocked: boolean;
  onSelect: (id: BusinessAccountTypeId) => void;
}) {
  const { t } = useTranslation();
  const includesFrom = plan.includesFromId
    ? getPlanById(plan.includesFromId)
    : null;
  const planLabel = t(plan.labelKey, plan.defaultLabel);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 3,
        border: `2px solid`,
        borderColor: isCurrent ? plan.color : 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
        '&:hover': {
          boxShadow: 4,
          borderColor: plan.color,
          transform: { md: 'translateY(-2px)' },
        },
      }}
    >
      <Box sx={{ bgcolor: plan.softColor, px: 2.5, pt: 2.5, pb: 2 }}>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Box minWidth={0}>
            <Typography sx={{ color: plan.color, letterSpacing: 1, mb: 0.5, fontSize: 14 }}>
              {'★'.repeat(plan.stars)}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ color: plan.color }}>
              {planLabel}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.25}>
              {t(plan.taglineKey, plan.defaultTagline)}
            </Typography>
          </Box>
          {isCurrent ? (
            <Chip
              label={t('business.accountType.currentPlan', 'Current Plan')}
              size="small"
              sx={{ bgcolor: plan.color, color: '#fff', fontWeight: 700, flexShrink: 0 }}
            />
          ) : null}
        </Box>
        <Typography variant="h3" fontWeight={800} mt={1.5} lineHeight={1.1}>
          {plan.commissionPercent}%
          <Typography component="span" variant="body2" color="text.secondary" ml={0.75}>
            {t('business.accountType.commissionSuffix', 'commission')}
          </Typography>
        </Typography>
      </Box>

      <Box sx={{ px: 2.5, pt: 2, pb: 1, flex: 1 }}>
        {includesFrom ? (
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ color: plan.color, mb: 1.25 }}
          >
            {t('business.accountType.everythingIn', 'Everything in {{plan}}, plus:', {
              plan: t(includesFrom.labelKey, includesFrom.defaultLabel),
            })}
          </Typography>
        ) : null}
        {plan.defaultBenefits.map((benefit, i) => (
          <Box key={i} display="flex" alignItems="flex-start" gap={1} mb={1}>
            <CheckCircleIcon sx={{ color: plan.color, fontSize: 18, mt: '2px' }} />
            <Typography variant="body2">
              {t(plan.benefitKeys[i] ?? benefit, benefit)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        {isCurrent ? (
          <Button
            variant="contained"
            disabled
            fullWidth
            sx={{
              bgcolor: plan.color,
              '&.Mui-disabled': { bgcolor: `${plan.color}99`, color: '#fff' },
            }}
          >
            {t('business.accountType.currentPlan', 'Current Plan')}
          </Button>
        ) : (
          <Button
            variant="contained"
            fullWidth
            disabled={isLocked}
            onClick={() => onSelect(plan.id)}
            sx={{
              bgcolor: plan.color,
              '&:hover': { bgcolor: plan.color, filter: 'brightness(0.92)' },
            }}
          >
            {isLocked
              ? t('business.accountType.planLocked', 'Locked')
              : t('business.accountType.selectPlan', 'Select {{plan}}', {
                  plan: planLabel,
                })}
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default BusinessAccountTypePage;
