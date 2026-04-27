import { useAuth0 } from '@auth0/auth0-react';
import {
  ArrowForward,
  CameraAlt as CameraAltIcon,
  LocationOn,
  Save,
} from '@mui/icons-material';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import axios from 'axios';
import { City, State } from 'country-state-city';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useApiClient } from '../../hooks/useApiClient';
import { useAgentReferralLookup } from '../../hooks/useAgentReferralLookup';
import { useDocumentManagement } from '../../hooks/useDocumentManagement';
import { useDocumentUpload } from '../../hooks/useDocumentUpload';
import { useUserTypes } from '../../hooks/useUserTypes';
import Logo from '../common/Logo';
import PhoneInput from '../common/PhoneInput';
import {
  type SignupGoalId,
  SignupGoalIllustration,
} from '../onboarding/SignupGoalIllustration';

const PROFILE_PICTURE_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
const PROFILE_PICTURE_MAX_SIZE = 5 * 1024 * 1024; // 5MB

const SIGNUP_COUNTRY_CODES = ['CM', 'GA', 'US', 'CA'] as const;

type PersonaKind = 'client' | 'business' | 'agent';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  user_type_id: string;
  /** Multi-select goals; drives personas + business main_interest */
  signup_goal_ids: SignupGoalId[];
  address: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
  };
  profile: {
    vehicle_type_id?: string;
    name?: string;
    main_interest?: 'sell_items' | 'rent_items';
  };
  referral_agent_code?: string;
}

const SIGNUP_GOAL_ORDER: SignupGoalId[] = [
  'browse_buy',
  'rent_and_earn',
  'sell_items',
  'delivery_agent',
];

/** English fallbacks when a translation key is missing */
const SIGNUP_GOAL_FALLBACKS: Record<
  SignupGoalId,
  { title: string; description: string }
> = {
  browse_buy: {
    title: 'I want to browse and buy items',
    description: 'Shop from businesses and enjoy delivery to your door.',
  },
  rent_and_earn: {
    title: 'I have items I want to rent and make money',
    description: 'List rentals, manage bookings, and grow rental income.',
  },
  sell_items: {
    title: 'I sell items',
    description: 'Run your store, catalog, orders, and locations in one place.',
  },
  delivery_agent: {
    title: 'I am a delivery agent',
    description: 'Pick up and deliver orders, track routes, and get paid.',
  },
};

const GOAL_TO_PERSONA: Record<SignupGoalId, PersonaKind> = {
  browse_buy: 'client',
  rent_and_earn: 'business',
  sell_items: 'business',
  delivery_agent: 'agent',
};

function personasFromSignupGoalIds(ids: SignupGoalId[]): PersonaKind[] {
  const s = new Set<PersonaKind>();
  for (const id of ids) s.add(GOAL_TO_PERSONA[id]);
  return Array.from(s);
}

function legacyUserTypeFromPersonas(personas: PersonaKind[]): PersonaKind {
  const order: PersonaKind[] = ['agent', 'business', 'client'];
  for (const p of order) {
    if (personas.includes(p)) return p;
  }
  return personas[0];
}

function nextMainInterestForSignupGoals(
  goalIds: SignupGoalId[],
  personas: PersonaKind[],
  current: 'sell_items' | 'rent_items' | undefined
): 'sell_items' | 'rent_items' | undefined {
  if (!personas.includes('business')) return current;
  const bizGoals = goalIds.filter((id) => GOAL_TO_PERSONA[id] === 'business');
  const hasRent = bizGoals.includes('rent_and_earn');
  const hasSell = bizGoals.includes('sell_items');
  if (hasRent && hasSell) {
    if (current === 'rent_items' || current === 'sell_items') return current;
    return 'sell_items';
  }
  if (bizGoals.includes('rent_and_earn')) return 'rent_items';
  if (bizGoals.includes('sell_items')) return 'sell_items';
  return 'sell_items';
}

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
    }}
  >
    {children}
  </Box>
);

const CompleteProfile: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { refetch, updateProfilePicture } = useUserProfileContext();
  const { loading: typesLoading, error: typesError } = useUserTypes();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: user?.given_name || '',
    last_name: user?.family_name || '',
    email: user?.email || '',
    phone_number: '',
    user_type_id: '',
    signup_goal_ids: [],
    address: {
      address_line_1: '',
      country: '',
      city: '',
      state: '',
    },
    profile: {},
    referral_agent_code: '',
  });
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [idDocumentFile, setIdDocumentFile] = useState<File | null>(null);
  const [idDocumentTypeId, setIdDocumentTypeId] = useState<number | ''>('');
  const profilePictureInputRef = useRef<HTMLInputElement>(null);
  const idDocumentInputRef = useRef<HTMLInputElement>(null);
  const stepScrollContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollStepToTop = (behavior: ScrollBehavior = 'smooth') => {
    const el = stepScrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior });
  };

  const selectedPersonas = useMemo(
    () => personasFromSignupGoalIds(profileData.signup_goal_ids),
    [profileData.signup_goal_ids]
  );

  const showBusinessFocusPicker =
    selectedPersonas.includes('business') &&
    profileData.signup_goal_ids.includes('rent_and_earn') &&
    profileData.signup_goal_ids.includes('sell_items');

  const steps = useMemo(() => {
    const s1 = t('completeProfile.step.whatBringsYou', 'What brings you here');
    const s2 = t('completeProfile.step.address', 'Address');
    const s3 = t('completeProfile.step.personal', 'Personal information');
    const s4 = t('completeProfile.step.review', 'Review & submit');
    const sId = t('completeProfile.step.idDocument', 'ID document (optional)');
    return selectedPersonas.includes('agent')
      ? [s1, s2, s3, sId, s4]
      : [s1, s2, s3, s4];
  }, [selectedPersonas, t]);
  const isAgent = selectedPersonas.includes('agent');

  const { documentTypes } = useDocumentManagement();
  const idDocumentTypes = useMemo(
    () =>
      documentTypes.filter((dt) =>
        ['id_card', 'passport', 'driver_license'].includes(dt.name)
      ),
    [documentTypes]
  );
  const { uploadFile: uploadDocumentFile } = useDocumentUpload();

  React.useEffect(() => {
    if (activeStep >= steps.length) {
      setActiveStep(Math.max(0, steps.length - 1));
    }
  }, [steps.length, activeStep]);

  const addressStates = useMemo(
    () => (profileData.address.country ? State.getStatesOfCountry(profileData.address.country) : []),
    [profileData.address.country]
  );

  const selectedStateCode = useMemo(() => {
    if (!profileData.address.state) return '';
    const found = addressStates.find(
      (s) => s.name === profileData.address.state
    );
    return found?.isoCode ?? '';
  }, [addressStates, profileData.address.state]);

  const addressCities = useMemo(() => {
    if (!profileData.address.country || !selectedStateCode) return [];
    return City.getCitiesOfState(profileData.address.country, selectedStateCode);
  }, [profileData.address.country, selectedStateCode]);

  useEffect(() => {
    const personas = personasFromSignupGoalIds(profileData.signup_goal_ids);
    if (personas.length === 0) return;
    setProfileData((prev) => {
      const mi = nextMainInterestForSignupGoals(
        prev.signup_goal_ids,
        personas,
        prev.profile.main_interest
      );
      return {
        ...prev,
        user_type_id: legacyUserTypeFromPersonas(personas),
        profile: {
          ...prev.profile,
          main_interest: mi ?? prev.profile.main_interest,
        },
      };
    });
  }, [profileData.signup_goal_ids]);

  const {
    result: referralLookup,
    loading: referralLookupLoading,
    error: referralLookupError,
  } = useAgentReferralLookup(profileData.referral_agent_code || '');

  const handleInputChange =
    (field: keyof ProfileData) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement>
        | { target: { value: unknown } }
    ) => {
      setProfileData({
        ...profileData,
        [field]: event.target.value,
      });
    };

  const handleProfileChange =
    (field: keyof ProfileData['profile']) =>
    (
      event:
        | React.ChangeEvent<HTMLInputElement>
        | { target: { value: unknown } }
    ) => {
      setProfileData({
        ...profileData,
        profile: {
          ...profileData.profile,
          [field]: event.target.value,
        },
      });
    };

  const handleGoalToggle = (goalId: SignupGoalId) => {
    setProfileData((prev) => {
      const ids = prev.signup_goal_ids;
      const has = ids.includes(goalId);
      if (has && ids.length <= 1) return prev;
      const signup_goal_ids = has
        ? ids.filter((id) => id !== goalId)
        : [...ids, goalId];
      return { ...prev, signup_goal_ids };
    });
  };

  const handleAddressChange = (field: keyof ProfileData['address'], value: string) => {
    setProfileData({
      ...profileData,
      address: {
        ...profileData.address,
        [field]: value,
        ...(field === 'country' && { state: '', city: '' }),
        ...(field === 'state' && { city: '' }),
      },
    });
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
    requestAnimationFrame(() => scrollStepToTop('smooth'));
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    requestAnimationFrame(() => scrollStepToTop('smooth'));
  };

  const handleSubmit = async () => {
    if (!apiClient) {
      setError(
        t(
          'completeProfile.errors.apiClientUnavailable',
          'Something went wrong loading the app. Please refresh the page.'
        )
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const personas = personasFromSignupGoalIds(profileData.signup_goal_ids);
      const createPayload = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        phone_number: profileData.phone_number,
        personas,
        user_type_id: legacyUserTypeFromPersonas(personas),
        profile: {
          vehicle_type_id: personas.includes('agent')
            ? profileData.profile.vehicle_type_id ?? 'other'
            : undefined,
          name: personas.includes('business')
            ? profileData.profile.name
            : undefined,
          main_interest: personas.includes('business')
            ? profileData.profile.main_interest
            : undefined,
        },
        address: profileData.address,
        referral_agent_code: profileData.referral_agent_code,
      };
      const { data: createResponse } = await apiClient.post<{
        success: boolean;
        user?: { id: string };
      }>('/users', createPayload);

      if (!createResponse?.success || !createResponse?.user?.id) {
        throw new Error(
          t(
            'completeProfile.errors.createUserFailed',
            'We could not create your account. Please try again.'
          )
        );
      }
      const userId = createResponse.user.id;

      try {
        await getAccessTokenSilently({ cacheMode: 'off' });
      } catch (tokenError) {
        console.warn('Failed to refresh Auth0 token:', tokenError);
      }

      await refetch();

      if (profilePictureFile) {
        try {
          const { data: picData } = await apiClient.post<{
            success: boolean;
            presigned_url?: string;
            final_url?: string;
            error?: string;
          }>('/users/profile-picture/presigned-url', {
            contentType: profilePictureFile.type,
            fileName: profilePictureFile.name,
            fileSize: profilePictureFile.size,
          });
          if (picData?.success && picData.presigned_url && picData.final_url) {
            await axios.put(picData.presigned_url, profilePictureFile, {
              headers: { 'Content-Type': profilePictureFile.type },
            });
            await updateProfilePicture(userId, picData.final_url);
          }
        } catch (picErr) {
          console.warn('Profile picture upload failed:', picErr);
        }
      }

      if (
        personas.includes('agent') &&
        idDocumentFile &&
        idDocumentTypeId !== ''
      ) {
        try {
          await uploadDocumentFile(idDocumentFile, idDocumentTypeId as number);
        } catch (docErr) {
          console.warn('ID document upload failed:', docErr);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/app');
      }, 2000);
    } catch (err: unknown) {
      const genericMessage = t(
        'completeProfile.errors.createUserGeneric',
        'Failed to complete your profile. Please try again.'
      );
      let errorMessage = genericMessage;

      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { error?: string } } })
          .response;
        if (response?.data?.error) {
          errorMessage = response.data.error;
        }
      } else if (err instanceof Error && err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 0:
        return profileData.signup_goal_ids.length > 0;
      case 1: {
        const a = profileData.address;
        return !!(
          a.address_line_1?.trim() &&
          a.country &&
          a.city?.trim() &&
          a.state
        );
      }
      case 2: {
        const personas = personasFromSignupGoalIds(profileData.signup_goal_ids);
        const hasRequiredFields =
          profileData.first_name &&
          profileData.last_name &&
          personas.length > 0;

        if (personas.includes('business')) {
          return (
            hasRequiredFields &&
            !!profileData.profile.name &&
            !!profileData.profile.main_interest
          );
        }

        return hasRequiredFields;
      }
      default:
        return true;
    }
  };

  const handleStepClick = (step: number) => {
    if (step < activeStep || (step === activeStep + 1 && isStepValid(activeStep))) {
      setActiveStep(step);
    }
  };

  const renderReviewContent = () => {
    const goalTitle = profileData.signup_goal_ids
      .map((gid) =>
        t(
          `completeProfile.signupGoals.${gid}.title`,
          SIGNUP_GOAL_FALLBACKS[gid].title
        )
      )
      .join('; ');
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, sm: 3 },
        }}
      >
        <Typography variant="h6" gutterBottom>
          {t('completeProfile.reviewTitle', 'Review Your Information')}
        </Typography>
        <Paper sx={{ p: { xs: 1.25, sm: 2 }, bgcolor: 'grey.50' }}>
          <Typography variant="body2" gutterBottom>
            <strong>
              {t('completeProfile.review.labels.fullName', 'Full name')}:
            </strong>{' '}
            {profileData.first_name} {profileData.last_name}
          </Typography>
          <Typography
            variant="body2"
            gutterBottom
            sx={{
              wordBreak: 'break-all',
              overflowWrap: 'anywhere',
            }}
          >
            <strong>{t('completeProfile.review.labels.email', 'Email')}:</strong>{' '}
            {profileData.email ||
              t('completeProfile.review.notProvided', 'Not provided')}
          </Typography>
          <Typography
            variant="body2"
            gutterBottom
            sx={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            <strong>
              {t('completeProfile.review.labels.phoneNumber', 'Phone number')}:
            </strong>{' '}
            {profileData.phone_number ||
              t('completeProfile.review.notProvided', 'Not provided')}
          </Typography>
          <Typography variant="body2" gutterBottom>
            <strong>
              {t('completeProfile.reviewYourGoal', 'Your goal')}:
            </strong>{' '}
            {goalTitle}
          </Typography>
          {selectedPersonas.includes('business') &&
            profileData.profile.name && (
              <Typography variant="body2" gutterBottom>
                <strong>
                  {t(
                    'completeProfile.review.labels.businessName',
                    'Business name'
                  )}
                  :
                </strong>{' '}
                {profileData.profile.name}
              </Typography>
            )}
          {selectedPersonas.includes('business') &&
            profileData.profile.main_interest && (
              <Typography variant="body2" gutterBottom>
                <strong>
                  {t('completeProfile.reviewMainInterest', 'Focus')}:
                </strong>{' '}
                {profileData.profile.main_interest === 'rent_items'
                  ? t(
                      'completeProfile.mainInterest.rentItems',
                      'Renting out items'
                    )
                  : t(
                      'completeProfile.mainInterest.sellItems',
                      'Selling products'
                    )}
              </Typography>
            )}
          {isAgent && (
            <>
              {profilePictureFile && (
                <Typography variant="body2" gutterBottom>
                  <strong>
                    {t(
                      'completeProfile.review.labels.profilePicture',
                      'Profile picture'
                    )}
                    :
                  </strong>{' '}
                  {t('completeProfile.added', 'Added')}
                </Typography>
              )}
              {(idDocumentFile && idDocumentTypeId) ? (
                <Typography variant="body2" gutterBottom>
                  <strong>
                    {t(
                      'completeProfile.review.labels.idDocument',
                      'ID document'
                    )}
                    :
                  </strong>{' '}
                  {t('completeProfile.added', 'Added')}
                </Typography>
              ) : (
                <Typography variant="body2" gutterBottom color="text.secondary">
                  <strong>
                    {t(
                      'completeProfile.review.labels.idDocument',
                      'ID document'
                    )}
                    :
                  </strong>{' '}
                  {t('completeProfile.skipped', 'Skipped')}
                </Typography>
              )}
            </>
          )}
          <Typography variant="body2" gutterBottom>
            <strong>
              {t('completeProfile.review.labels.address', 'Address')}:
            </strong>{' '}
            {profileData.address.address_line_1},{' '}
            {profileData.address.city}, {profileData.address.state},{' '}
            {profileData.address.country
              ? t(
                  `completeProfile.countries.${profileData.address.country}`,
                  profileData.address.country
                )
              : ''}
          </Typography>
        </Paper>
      </Box>
    );
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t(
                'completeProfile.whatBringsYouTitle',
                'What brings you here today?'
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t(
                'completeProfile.whatBringsYouHintMulti',
                'Select all that apply—you can use more than one mode on one account.'
              )}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                },
                gap: { xs: 1.5, sm: 2 },
              }}
            >
              {SIGNUP_GOAL_ORDER.map((goalId) => {
                const titleKey = `completeProfile.signupGoals.${goalId}.title`;
                const descKey = `completeProfile.signupGoals.${goalId}.description`;
                const colors: Record<SignupGoalId, string> = {
                  browse_buy: theme.palette.primary.main,
                  rent_and_earn: '#00897b',
                  sell_items: '#f57c00',
                  delivery_agent: '#388e3c',
                };
                const accent = colors[goalId];
                const selected = profileData.signup_goal_ids.includes(goalId);
                return (
                  <Card
                    key={goalId}
                    sx={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: selected ? 2 : 1,
                      borderColor: selected ? accent : 'divider',
                      transition: 'box-shadow 0.2s, border-color 0.2s',
                      '&:hover': {
                        borderColor: accent,
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleGoalToggle(goalId)}
                  >
                    <CardContent
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        py: { xs: 2, sm: 2.5 },
                        px: 1.5,
                      }}
                    >
                      <Checkbox
                        checked={selected}
                        size="small"
                        onChange={() => handleGoalToggle(goalId)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, p: 0.5 }}
                      />
                      <Box sx={{ width: '100%', maxWidth: 120, mb: 1.5 }}>
                        <SignupGoalIllustration goalId={goalId} accent={accent} />
                      </Box>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        {t(titleKey, SIGNUP_GOAL_FALLBACKS[goalId].title)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(descKey, SIGNUP_GOAL_FALLBACKS[goalId].description)}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LocationOn color="primary" />
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                {t('completeProfile.addressStep', 'Address')}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('completeProfile.addressStepHint', 'We use your address to tailor content and delivery options for you.')}
            </Typography>

            <TextField
              label={t('completeProfile.addressLine1', 'Address Line 1')}
              value={profileData.address.address_line_1}
              onChange={(e) => handleAddressChange('address_line_1', e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth required>
              <InputLabel>{t('completeProfile.country', 'Country')}</InputLabel>
              <Select
                value={profileData.address.country}
                label={t('completeProfile.country', 'Country')}
                onChange={(e) => handleAddressChange('country', e.target.value)}
              >
                {SIGNUP_COUNTRY_CODES.map((code) => (
                  <MenuItem key={code} value={code}>
                    {t(`completeProfile.countries.${code}`, code)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required disabled={!profileData.address.country}>
              <InputLabel>{t('completeProfile.state', 'State / Region')}</InputLabel>
              <Select
                value={profileData.address.state}
                label={t('completeProfile.state', 'State / Region')}
                onChange={(e) => handleAddressChange('state', e.target.value)}
              >
                {addressStates.map((s) => (
                  <MenuItem key={s.isoCode} value={s.name}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Autocomplete
              freeSolo
              options={addressCities.map((c) => c.name)}
              value={profileData.address.city}
              onInputChange={(_, value) => handleAddressChange('city', value ?? '')}
              onChange={(_, value) => handleAddressChange('city', typeof value === 'string' ? value : value ?? '')}
              disabled={!profileData.address.country || !profileData.address.state}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('completeProfile.city', 'City')}
                  required
                />
              )}
            />
          </Box>
        );

      case 2:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: { xs: 2, sm: 3 },
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t('completeProfile.personalInformation', 'Personal Information')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar
                  src={profilePictureFile ? URL.createObjectURL(profilePictureFile) : undefined}
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: 'grey.200',
                    color: 'grey.600',
                    fontSize: '1.5rem',
                  }}
                >
                  {profileData.first_name?.[0]}
                  {profileData.last_name?.[0]}
                </Avatar>
                <input
                  ref={profilePictureInputRef}
                  type="file"
                  accept={PROFILE_PICTURE_ACCEPT}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > PROFILE_PICTURE_MAX_SIZE) return;
                    const accepted = PROFILE_PICTURE_ACCEPT.split(',');
                    if (!accepted.includes(file.type)) return;
                    setProfilePictureFile(file);
                  }}
                />
                <IconButton
                  size="small"
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    minWidth: 36,
                    minHeight: 36,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => profilePictureInputRef.current?.click()}
                  aria-label={t('completeProfile.profilePicture', 'Profile picture')}
                >
                  <CameraAltIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {t('completeProfile.profilePictureHint', 'JPG, PNG or WebP. Max 5MB.')}
              </Typography>
            </Box>

            <TextField
              label={t('profile.firstName', 'First Name')}
              value={profileData.first_name}
              onChange={handleInputChange('first_name')}
              fullWidth
              required
              helperText={t('completeProfile.firstNameHelper', 'Enter as shown on your ID card.')}
            />

            <TextField
              label={t('profile.lastName', 'Last Name')}
              value={profileData.last_name}
              onChange={handleInputChange('last_name')}
              fullWidth
              required
              helperText={t('completeProfile.lastNameHelper', 'Enter as shown on your ID card.')}
            />

            <PhoneInput
              value={profileData.phone_number}
              onChange={(value) =>
                setProfileData({
                  ...profileData,
                  phone_number: value || '',
                })
              }
              label={t('completeProfile.phone.label', 'Phone number')}
              helperText={t(
                'completeProfile.phone.helper',
                'Use the mobile number for your mobile money account; it will be used for payments on this account.'
              )}
              required
              useDevPhoneDropdown
            />

            {selectedPersonas.includes('business') && (
              <>
                <TextField
                  label={t(
                    'completeProfile.businessNameLabel',
                    'Business name'
                  )}
                  value={profileData.profile.name || ''}
                  onChange={handleProfileChange('name')}
                  fullWidth
                  required
                />
                {showBusinessFocusPicker && (
                  <FormControl fullWidth required>
                    <InputLabel>
                      {t('signupPage.primaryBusinessFocus', 'Primary business focus')}
                    </InputLabel>
                    <Select
                      value={profileData.profile.main_interest ?? 'sell_items'}
                      label={t('signupPage.primaryBusinessFocus', 'Primary business focus')}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          profile: {
                            ...profileData.profile,
                            main_interest: e.target.value as
                              | 'sell_items'
                              | 'rent_items',
                          },
                        })
                      }
                    >
                      <MenuItem value="sell_items">
                        {t('completeProfile.mainInterest.sellItems', 'Selling products')}
                      </MenuItem>
                      <MenuItem value="rent_items">
                        {t('completeProfile.mainInterest.rentItems', 'Renting out items')}
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              </>
            )}

            {selectedPersonas.includes('agent') && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <TextField
                  label={t(
                    'agent.referrals.referralCodeLabel',
                    'Referral code (optional)'
                  )}
                  value={profileData.referral_agent_code || ''}
                  onChange={handleInputChange('referral_agent_code')}
                  fullWidth
                  helperText={t(
                    'agent.referrals.referralCodeHelp',
                    'Enter the code of the agent who referred you (if any).'
                  )}
                />
                {profileData.referral_agent_code &&
                  profileData.referral_agent_code.trim().length === 6 && (
                    <Box sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {referralLookupLoading && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CircularProgress size={14} />
                          <span>
                            {t(
                              'agent.referrals.lookupLoading',
                              'Looking up agent...'
                            )}
                          </span>
                        </Box>
                      )}
                      {!referralLookupLoading && referralLookup && (
                        <span>
                          {t(
                            'agent.referrals.lookupSuccess',
                            'Referred by {{name}}',
                            { name: referralLookup.fullName }
                          )}
                        </span>
                      )}
                      {!referralLookupLoading &&
                        !referralLookup &&
                        referralLookupError && (
                          <span>
                            {t(
                              'agent.referrals.lookupError',
                              'No agent found for this code'
                            )}
                          </span>
                        )}
                    </Box>
                  )}
              </Box>
            )}
          </Box>
        );

      case 3:
        if (isAgent) {
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: { xs: 2, sm: 3 },
              }}
            >
              <Typography variant="h6" gutterBottom>
                {t('completeProfile.idDocumentStepTitle', 'ID Document (optional)')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'completeProfile.idDocumentRequiredNote',
                  'Required for your account to become active. You can skip now and add it later from your Documents.'
                )}
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel id="id-doc-type-label">
                  {t('completeProfile.idDocumentTypeLabel', 'Document type')}
                </InputLabel>
                <Select
                  labelId="id-doc-type-label"
                  label={t('completeProfile.idDocumentTypeLabel', 'Document type')}
                  value={idDocumentTypeId}
                  onChange={(e) =>
                    setIdDocumentTypeId(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                >
                  <MenuItem value="">
                    <em>{t('common.none', 'None')}</em>
                  </MenuItem>
                  {idDocumentTypes.map((dt) => (
                    <MenuItem key={dt.id} value={dt.id}>
                      {dt.description || dt.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <input
                ref={idDocumentInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const maxSize = 10 * 1024 * 1024;
                  if (file.size > maxSize) return;
                  setIdDocumentFile(file);
                }}
              />
              <Button
                variant="outlined"
                onClick={() => idDocumentInputRef.current?.click()}
              >
                {idDocumentFile
                  ? idDocumentFile.name
                  : t('completeProfile.idDocumentSelectFile', 'Select file')}
              </Button>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIdDocumentFile(null);
                    setIdDocumentTypeId('');
                    handleNext();
                  }}
                >
                  {t('completeProfile.idDocumentSkip', 'Skip for now')}
                </Button>
              </Box>
            </Box>
          );
        }
        return renderReviewContent();

      case 4:
        return renderReviewContent();

      default:
        return null;
    }
  };

  if (typesError) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: { xs: 1, sm: 2 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 6 },
            textAlign: 'center',
            maxWidth: 500,
            width: '90%',
          }}
        >
          <Alert severity="error" sx={{ mb: 3 }}>
            {typesError}
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            {t('common.retry', 'Retry')}
          </Button>
        </Paper>
      </Box>
    );
  }

  if (success) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: { xs: 1, sm: 2 },
        }}
      >
        <Paper
          sx={{
            p: { xs: 3, sm: 6 },
            textAlign: 'center',
            maxWidth: 500,
            width: '90%',
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Logo variant="default" size="large" />
          </Box>
          <Typography variant="h5" component="h1" gutterBottom>
            {t('completeProfile.successTitle', 'Profile complete')}
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {t(
              'completeProfile.successMessage',
              'Your profile was created successfully. Redirecting to your dashboard…'
            )}
          </Typography>
          <CircularProgress size={24} />
        </Paper>
      </Box>
    );
  }

  const stepContent = (
    <>
      <Box sx={{ textAlign: 'center', mb: { xs: 1.5, sm: 4 } }}>
        <Box sx={{ mb: { xs: 1, sm: 2 } }}>
          <Logo variant="default" size="large" />
        </Box>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          {t('completeProfile.title', 'Complete Your Profile')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('completeProfile.subtitle', 'Please provide some additional information to complete your account setup')}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: { xs: 2, sm: 3 } }}>
          {error}
        </Alert>
      )}

      {typesLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 2, sm: 3 } }}>
          <CircularProgress />
        </Box>
      )}

      <Stepper
        activeStep={activeStep}
        sx={{ mb: { xs: 1.5, sm: 4 }, overflow: 'auto', py: 1.5, px: { xs: 0, sm: 2 } }}
      >
        {steps.map((_, index) => (
          <Step key={index}>
            <StepButton
              onClick={() => handleStepClick(index)}
              aria-label={steps[index]}
              icon={
                <StepIconWrapper
                  completed={index < activeStep}
                  active={index === activeStep}
                >
                  {index + 1}
                </StepIconWrapper>
              }
              sx={{ cursor: index <= activeStep ? 'pointer' : 'default' }}
            />
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mb: { xs: 1.5, sm: 4 } }}>{renderStepContent(activeStep)}</Box>
    </>
  );

  const navButtons = (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Button disabled={activeStep === 0} onClick={handleBack}>
        {t('common.back', 'Back')}
      </Button>
      <Box>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading || !isStepValid(activeStep) || typesLoading}
            startIcon={loading ? <CircularProgress size={20} /> : <Save />}
          >
            {loading ? t('completeProfile.creating', 'Creating...') : t('completeProfile.completeButton', 'Complete Profile')}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep) || typesLoading}
            endIcon={<ArrowForward />}
          >
            {t('common.next', 'Next')}
          </Button>
        )}
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Dialog
        fullScreen
        open
        PaperProps={{ sx: { m: 0, maxHeight: '100dvh', borderRadius: 0 } }}
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
          <Box sx={{ flexShrink: 0, px: 2, pt: 2, pb: 1 }}>
            <Button onClick={activeStep === 0 ? () => navigate(-1) : handleBack} size="small">
              {t('common.back', 'Back')}
            </Button>
          </Box>
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              minHeight: 0,
              px: 2,
              pb: 2,
            }}
            ref={stepScrollContainerRef}
          >
            <Box sx={{ maxWidth: 600, mx: 'auto', width: '100%' }}>{stepContent}</Box>
          </Box>
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                disabled={activeStep === 0}
                onClick={handleBack}
                variant="outlined"
                fullWidth
              >
                {t('common.back', 'Back')}
              </Button>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading || !isStepValid(activeStep) || typesLoading}
                  startIcon={loading ? <CircularProgress size={20} /> : <Save />}
                  fullWidth
                >
                  {loading ? t('completeProfile.creating', 'Creating...') : t('completeProfile.completeButton', 'Complete Profile')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!isStepValid(activeStep) || typesLoading}
                  endIcon={<ArrowForward />}
                  fullWidth
                >
                  {t('common.next', 'Next')}
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: { xs: 1, sm: 2 },
      }}
    >
      <Paper sx={{ p: { xs: 1.5, sm: 4 }, maxWidth: 800, width: '100%' }}>
        {stepContent}
        {navButtons}
      </Paper>
    </Box>
  );
};

export default CompleteProfile;
