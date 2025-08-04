import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, Snackbar, Typography } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * EmailVerificationNotice Component
 *
 * Displays a warning notice below the header when a user is authenticated
 * but their email is not yet verified. The notice includes:
 * - A warning message with the user's email address
 * - A button to request a new verification email
 * - Success/error feedback via Snackbar notifications
 *
 * The component automatically hides itself when:
 * - User is not authenticated
 * - User's email is already verified
 *
 * When the resend button is clicked, it redirects to Auth0's verification page
 * where users can request a new verification email.
 */
const EmailVerificationNotice: React.FC = () => {
  const { user, isAuthenticated } = useAuth0();
  const { t } = useTranslation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Don't show if user is not authenticated or email is already verified
  if (!isAuthenticated || !user || user.email_verified) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      // For Auth0, we need to redirect to their verification page
      // This will allow users to request a new verification email
      const auth0Domain = process.env.REACT_APP_AUTH0_DOMAIN;
      const clientId = process.env.REACT_APP_AUTH0_CLIENT_ID;
      const redirectUri = window.location.origin;

      // Redirect to Auth0's verification page
      const verificationUrl = `https://${auth0Domain}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=openid%20profile%20email&prompt=login&screen_hint=signup`;

      window.location.href = verificationUrl;
    } catch (error) {
      console.error('Error redirecting to verification page:', error);
      setShowError(true);
    } finally {
      setIsResending(false);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  return (
    <>
      <Box
        sx={{
          py: 2,
          px: 2,
          backgroundColor: 'warning.light',
          borderBottom: '1px solid',
          borderColor: 'warning.main',
        }}
      >
        <Alert
          severity="warning"
          variant="filled"
          sx={{
            backgroundColor: 'warning.main',
            color: 'warning.contrastText',
            '& .MuiAlert-message': {
              width: '100%',
            },
            '& .MuiAlert-icon': {
              color: 'warning.contrastText',
            },
          }}
          action={
            <Button
              variant="outlined"
              size="small"
              onClick={handleResendEmail}
              disabled={isResending}
              sx={{
                ml: 2,
                color: 'warning.contrastText',
                borderColor: 'warning.contrastText',
                '&:hover': {
                  borderColor: 'warning.contrastText',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {isResending
                ? t('common.loading')
                : t('auth.emailVerification.resendButton')}
            </Button>
          }
        >
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              gutterBottom
              sx={{ color: 'warning.contrastText' }}
            >
              {t('auth.emailVerification.title')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'warning.contrastText' }}>
              {t('auth.emailVerification.message', { email: user.email })}
            </Typography>
          </Box>
        </Alert>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={6000}
        onClose={handleCloseSuccess}
        message={t('auth.emailVerification.resendSuccess')}
      />

      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={handleCloseError}
        message={t('auth.emailVerification.resendError')}
      />
    </>
  );
};

export default EmailVerificationNotice;
