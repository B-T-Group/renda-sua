import { useAuth0 } from '@auth0/auth0-react';
import { CheckCircle, Email, Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserVerification } from '../../hooks/useUserVerification';
import Logo from '../common/Logo';

/**
 * EmailVerificationPage Component
 *
 * A dedicated page that blocks users from accessing protected routes
 * if their email is not verified. Provides:
 * - Clear explanation of why access is blocked
 * - User's email address for reference
 * - Button to resend verification email
 * - Success/error feedback
 * - Option to logout if needed
 */
const EmailVerificationPage: React.FC = () => {
  const { user, logout, getAccessTokenSilently } = useAuth0();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resendVerificationEmail } = useUserVerification();
  const [isResending, setIsResending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleResendEmail = async () => {
    setIsResending(true);
    setShowSuccess(false);
    setShowError(false);
    setErrorMessage('');

    try {
      await resendVerificationEmail();
      setShowSuccess(true);
    } catch (error: unknown) {
      console.error('Error resending verification email:', error);
      setShowError(true);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to send verification email. Please try again.'
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setShowSuccess(false);
    setShowError(false);
    setErrorMessage('');

    try {
      // Get a fresh access token
      const token = await getAccessTokenSilently({
        cacheMode: 'off',
      });

      // Make a direct call to Auth0's userinfo endpoint to get fresh user data
      const response = await fetch(
        `https://${process.env.REACT_APP_AUTH0_DOMAIN}/userinfo`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user information');
      }

      const freshUserData = await response.json();

      // Check if email is now verified
      if (freshUserData.email_verified) {
        // Email is verified, redirect to the app
        navigate('/app');
      } else {
        // Email still not verified, show success message
        setShowSuccess(true);
      }
    } catch (error: unknown) {
      console.error('Error refreshing verification status:', error);
      setShowError(true);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to refresh verification status. Please try again.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Container maxWidth="sm" sx={{ px: { xs: 1, sm: 0 } }}>
        <Card
          sx={{
            textAlign: 'center',
            p: { xs: 3, sm: 4 },
            boxShadow: 3,
          }}
        >
          <CardContent>
            {/* Logo */}
            <Box sx={{ mb: 3 }}>
              <Logo variant="default" size="large" />
            </Box>

            {/* Email Icon */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <Email
                sx={{
                  fontSize: 64,
                  color: 'primary.main',
                }}
              />
            </Box>

            {/* Title */}
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                mb: 2,
              }}
            >
              {t(
                'auth.emailVerification.pageTitle',
                'Verify Your Email Address'
              )}
            </Typography>

            {/* Description */}
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                mb: 3,
                lineHeight: 1.6,
              }}
            >
              {t(
                'auth.emailVerification.pageDescription',
                'To access your account, please verify your email address. We sent a verification link to:'
              )}
            </Typography>

            {/* Email Address */}
            <Box
              sx={{
                bgcolor: 'grey.50',
                p: 2,
                borderRadius: 2,
                mb: 3,
              }}
            >
              <Typography
                variant="body1"
                sx={{
                  fontWeight: 600,
                  color: 'primary.main',
                }}
              >
                {user?.email}
              </Typography>
            </Box>

            {/* Instructions */}
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 4,
                lineHeight: 1.6,
              }}
            >
              {t(
                'auth.emailVerification.instructions',
                "Check your email and click the verification link. If you don't see the email, check your spam folder or click the button below to resend it."
              )}
            </Typography>

            {/* Success Message */}
            {showSuccess && (
              <Alert
                severity="success"
                sx={{
                  mb: 3,
                  textAlign: 'left',
                }}
              >
                {t(
                  'auth.emailVerification.resendSuccess',
                  'Verification email sent successfully! Please check your inbox.'
                )}
              </Alert>
            )}

            {/* Error Message */}
            {showError && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  textAlign: 'left',
                }}
              >
                {errorMessage ||
                  t(
                    'auth.emailVerification.resendError',
                    'Failed to send verification email. Please try again.'
                  )}
              </Alert>
            )}

            {/* Action Buttons */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'center',
              }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={handleResendEmail}
                disabled={isResending || isRefreshing}
                startIcon={
                  isResending ? <CircularProgress size={20} /> : <Refresh />
                }
                sx={{
                  minWidth: { xs: '100%', sm: 200 },
                  py: 1.5,
                }}
              >
                {isResending
                  ? t('auth.emailVerification.resending', 'Sending...')
                  : t(
                      'auth.emailVerification.resendButton',
                      'Resend Verification Email'
                    )}
              </Button>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 1,
                  textAlign: 'center',
                  px: { xs: 1, sm: 0 },
                }}
              >
                {t(
                  'auth.emailVerification.refreshHelper',
                  'After you have clicked the verification link in your email, tap the button below.'
                )}
              </Typography>

              <Button
                variant="outlined"
                size="large"
                onClick={handleRefresh}
                disabled={isResending || isRefreshing}
                startIcon={
                  isRefreshing ? (
                    <CircularProgress size={20} />
                  ) : (
                    <CheckCircle />
                  )
                }
                sx={{
                  minWidth: { xs: '100%', sm: 200 },
                  width: '100%',
                  py: 1.5,
                }}
              >
                {isRefreshing
                  ? t('auth.emailVerification.refreshing', 'Checking...')
                  : t(
                      'auth.emailVerification.refreshButton',
                      'Click here after verifying your email'
                    )}
              </Button>

              <Button
                variant="outlined"
                size="large"
                onClick={handleLogout}
                disabled={isResending || isRefreshing}
                sx={{
                  minWidth: { xs: '100%', sm: 200 },
                  width: '100%',
                  py: 1.5,
                }}
              >
                {t('auth.emailVerification.logoutButton', 'Logout')}
              </Button>
            </Box>

            {/* Help Text */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mt: 3,
                display: 'block',
              }}
            >
              {t(
                'auth.emailVerification.helpText',
                'Having trouble? Contact support for assistance.'
              )}
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default EmailVerificationPage;
