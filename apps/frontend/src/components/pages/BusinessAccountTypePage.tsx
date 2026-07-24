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
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import LockIcon from '@mui/icons-material/Lock';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessAccountType } from '../../hooks/useBusinessAccountType';
import {
  BUSINESS_ACCOUNT_TYPE_PLANS,
  type BusinessAccountTypeId,
} from '../../constants/businessAccountTypes';
import { AccountTypeTiersIllustration } from '../illustrations/AccountTypeTiersIllustration';
import SEOHead from '../seo/SEOHead';

const BusinessAccountTypePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    accountType,
    plan: currentPlan,
    isLocked,
    lockedUntilLabel,
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
      setChangeError(err?.message || t('business.accountType.changeFailed', 'Failed to change plan'));
    } finally {
      setChanging(false);
    }
  };

  const selectedPlan = selectedType
    ? BUSINESS_ACCOUNT_TYPE_PLANS.find((p) => p.id === selectedType)
    : null;

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <SEOHead
        title={t('business.accountType.pageTitle', 'Account & Plan')}
        description={t('business.accountType.pageDescription', 'Choose the right plan for your business on Rendasua.')}
      />

      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        {t('common.back', 'Back')}
      </Button>

      {/* Header + illustration */}
      <Box display="flex" alignItems="center" gap={3} mb={4} flexWrap="wrap">
        <AccountTypeTiersIllustration width={130} height={110} />
        <Box>
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

      {isLocked && lockedMessage && (
        <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 3 }}>
          {lockedMessage}
        </Alert>
      )}

      {(changeError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {changeError}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {!loading && (
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={3}>
          {BUSINESS_ACCOUNT_TYPE_PLANS.map((plan) => {
            const isCurrentPlan = plan.id === accountType;
            return (
              <Box
                key={plan.id}
                sx={{
                  flex: 1,
                  border: `2px solid`,
                  borderColor: isCurrentPlan ? plan.color : 'divider',
                  borderRadius: 3,
                  p: 3,
                  position: 'relative',
                  bgcolor: isCurrentPlan ? `${plan.color}08` : 'background.paper',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  '&:hover': { boxShadow: 4, borderColor: plan.color },
                }}
              >
                {isCurrentPlan && (
                  <Chip
                    label={t('business.accountType.currentPlan', 'Current Plan')}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -14,
                      right: 16,
                      bgcolor: plan.color,
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  />
                )}

                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  {Array.from({ length: plan.stars }).map((_, i) => (
                    <StarIcon key={i} sx={{ color: plan.color, fontSize: 20 }} />
                  ))}
                </Box>

                <Typography variant="h6" fontWeight={700} sx={{ color: plan.color }}>
                  {t(plan.labelKey, plan.defaultLabel)}
                </Typography>

                <Typography variant="h4" fontWeight={800} mt={1} mb={2}>
                  {plan.commissionPercent}%
                  <Typography component="span" variant="body2" color="text.secondary" ml={0.5}>
                    {t('business.accountType.commissionSuffix', 'commission')}
                  </Typography>
                </Typography>

                <Divider sx={{ mb: 2 }} />

                <List dense disablePadding>
                  {plan.defaultBenefits.map((benefit, i) => (
                    <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <CheckCircleIcon sx={{ color: plan.color, fontSize: 16 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2">
                            {t(plan.benefitKeys[i] ?? benefit, benefit)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>

                <Box mt={3}>
                  {isCurrentPlan ? (
                    <Button
                      variant="contained"
                      disabled
                      fullWidth
                      sx={{ bgcolor: plan.color, '&.Mui-disabled': { bgcolor: `${plan.color}60`, color: '#fff' } }}
                    >
                      {t('business.accountType.currentPlan', 'Current Plan')}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      fullWidth
                      disabled={isLocked}
                      sx={{ borderColor: plan.color, color: plan.color }}
                      onClick={() => handleSelect(plan.id)}
                    >
                      {isLocked
                        ? t('business.accountType.planLocked', 'Locked')
                        : t('business.accountType.selectPlan', 'Select {{plan}}', {
                            plan: t(plan.labelKey, plan.defaultLabel),
                          })}
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" display="block" mt={4} textAlign="center">
        {t(
          'business.accountType.lockInNote',
          'After changing your plan, a 30-day commitment period begins. You can change again after that period ends.'
        )}
      </Typography>

      {confirmOpen && selectedPlan && (
        <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); setSelectedType(null); }} maxWidth="sm" fullWidth>
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
            {changeError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {changeError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => { setConfirmOpen(false); setSelectedType(null); }}
              disabled={changing}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              disabled={changing}
              sx={{ bgcolor: selectedPlan.color }}
            >
              {changing ? <CircularProgress size={18} color="inherit" /> : t('business.accountType.confirmChangeBtn', 'Confirm Change')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default BusinessAccountTypePage;
