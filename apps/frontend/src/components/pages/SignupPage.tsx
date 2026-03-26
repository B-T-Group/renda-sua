import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, MenuItem, Paper, Stack, TextField, Typography, useTheme } from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import Logo from '../common/Logo';
import PhoneInput from '../common/PhoneInput';
import { SignupGoalIllustration, type SignupGoalId } from '../onboarding/SignupGoalIllustration';

type SignupIntent = 'client_buy' | 'business_sell' | 'business_rent';
type UserType = 'client' | 'business' | 'agent';
type MainInterest = 'sell_items' | 'rent_items';

interface SignupGoalOption {
  id: SignupGoalId;
  title: string;
  description: string;
  accent: string;
  userType: UserType;
  mainInterest?: MainInterest;
}

const intentDefaults = (intent: SignupIntent | null) => {
  if (intent === 'business_sell') return { user_type_id: 'business' as UserType, main_interest: 'sell_items' as const };
  if (intent === 'business_rent') return { user_type_id: 'business' as UserType, main_interest: 'rent_items' as const };
  return { user_type_id: 'client' as UserType, main_interest: undefined };
};

const SignupPage: React.FC = () => {
  const theme = useTheme();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const defaults = useMemo(() => intentDefaults((search.get('intent') as SignupIntent | null) || null), [search]);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    user_type_id: defaults.user_type_id,
    business_name: '',
    main_interest: defaults.main_interest || 'sell_items',
  });
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupGoal, setSignupGoal] = useState<SignupGoalId>(
    defaults.user_type_id === 'business'
      ? defaults.main_interest === 'rent_items'
        ? 'rent_and_earn'
        : 'sell_items'
      : 'browse_buy'
  );

  const goalOptions: SignupGoalOption[] = useMemo(
    () => [
      {
        id: 'browse_buy',
        title: 'I want to buy stuff',
        description: 'Shop products and get fast delivery to your location.',
        accent: theme.palette.primary.main,
        userType: 'client',
      },
      {
        id: 'rent_and_earn',
        title: 'I want to rent stuff',
        description: 'List items for rent and earn from bookings.',
        accent: '#00897b',
        userType: 'business',
        mainInterest: 'rent_items',
      },
      {
        id: 'sell_items',
        title: 'I want to sell stuff',
        description: 'Open your business store and manage sales.',
        accent: '#f57c00',
        userType: 'business',
        mainInterest: 'sell_items',
      },
      {
        id: 'delivery_agent',
        title: 'I want to make money via deliveries',
        description: 'Deliver customer orders and get paid for each trip.',
        accent: '#388e3c',
        userType: 'agent',
      },
    ],
    [theme.palette.primary.main]
  );

  useEffect(() => {
    const initialGoal =
      defaults.user_type_id === 'business'
        ? defaults.main_interest === 'rent_items'
          ? 'rent_and_earn'
          : 'sell_items'
        : 'browse_buy';
    setSignupGoal(initialGoal);
    setForm((prev) => ({
      ...prev,
      user_type_id: defaults.user_type_id,
      main_interest: defaults.main_interest || prev.main_interest,
    }));
  }, [defaults]);

  const handleGoalSelect = (goalId: SignupGoalId) => {
    const selected = goalOptions.find((option) => option.id === goalId);
    if (!selected) return;
    setSignupGoal(goalId);
    setForm((prev) => ({
      ...prev,
      user_type_id: selected.userType,
      main_interest: selected.mainInterest || prev.main_interest,
    }));
  };

  useEffect(() => {
    if (!form.email || form.email.length < 5) {
      setEmailTaken(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setCheckingEmail(true);
        const { data } = await apiClient.get<{ taken: boolean }>('/auth/email-availability', { params: { email: form.email } });
        setEmailTaken(Boolean(data?.taken));
      } catch {
        setEmailTaken(false);
      } finally {
        setCheckingEmail(false);
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [apiClient, form.email]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone_number: form.phone_number,
        user_type_id: form.user_type_id,
        profile: {
          name: form.user_type_id === 'business' ? form.business_name : undefined,
          main_interest: form.user_type_id === 'business' ? form.main_interest : undefined,
        },
      };
      const { data } = await apiClient.post<{ success: boolean; userId: string; otpSent: boolean }>('/auth/signup/start', payload);
      sessionStorage.setItem('pendingSignupUserId', data.userId);
      sessionStorage.setItem('pendingSignupEmail', form.email.trim().toLowerCase());
      navigate('/auth/otp?flow=signup');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to create account at this time.');
    } finally {
      setSaving(false);
    }
  };

  const disableSubmit = saving || checkingEmail || emailTaken || !form.first_name || !form.last_name || !form.email || (form.user_type_id === 'business' && !form.business_name);

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Logo variant="default" size="medium" />
          </Box>
          <Typography variant="h4">Create your account</Typography>
          <Typography color="text.secondary">Set up your profile first, then verify with an OTP sent to your email.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="First name" value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} required />
          <TextField label="Last name" value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} required />
          <TextField
            label="Email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
            error={emailTaken}
            helperText={emailTaken ? 'This email is already taken.' : checkingEmail ? 'Checking email availability...' : ' '}
          />
          <PhoneInput
            value={form.phone_number}
            onChange={(value) =>
              setForm((p) => ({
                ...p,
                phone_number: value || '',
              }))
            }
            label="Phone number"
            helperText="Use the mobile number linked to your payment account."
            required
            useDevPhoneDropdown
          />
          <Box>
            <Typography variant="subtitle1" sx={{ mb: 1 }}>
              Choose what you want to do
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This helps us set up the right account experience for you.
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
                gap: 1.5,
              }}
            >
              {goalOptions.map((goal) => {
                const selected = signupGoal === goal.id;
                return (
                  <Card
                    key={goal.id}
                    sx={{
                      cursor: 'pointer',
                      border: selected ? 2 : 1,
                      borderColor: selected ? goal.accent : 'divider',
                      transition: 'box-shadow 0.2s, border-color 0.2s',
                      '&:hover': {
                        borderColor: goal.accent,
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleGoalSelect(goal.id)}
                  >
                    <CardContent sx={{ py: 2, px: 1.5 }}>
                      <Box sx={{ width: '100%', maxWidth: 92, mb: 1, mx: 'auto' }}>
                        <SignupGoalIllustration goalId={goal.id} accent={goal.accent} />
                      </Box>
                      <Typography variant="subtitle2" fontWeight={700} textAlign="center" gutterBottom>
                        {goal.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        {goal.description}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>
          {form.user_type_id === 'business' && (
            <>
              <TextField label="Business name" value={form.business_name} onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))} required />
              <TextField select label="Business focus" value={form.main_interest} onChange={(e) => setForm((p) => ({ ...p, main_interest: e.target.value }))}>
                <MenuItem value="sell_items">Sell items</MenuItem>
                <MenuItem value="rent_items">Rent items</MenuItem>
              </TextField>
            </>
          )}
          <Button variant="contained" size="large" onClick={handleCreate} disabled={disableSubmit} startIcon={saving ? <CircularProgress size={18} /> : undefined}>
            {saving ? 'Creating...' : 'Create account'}
          </Button>
          <Box>
            <Button onClick={() => navigate('/auth/login')}>Already have an account? Log in</Button>
          </Box>
        </Stack>
      </Paper>
    </Container>
  );
};

export default SignupPage;
