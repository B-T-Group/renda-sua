import { useAuth0 } from '@auth0/auth0-react';
import { Close, Email } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserVerification } from '../../hooks/useUserVerification';

/**
 * EmailVerificationNotice Component
 *
 * Displays a subtle notification when a user is authenticated
 * but their email is not yet verified. The notice includes:
 * - A gentle message with the user's email address
 * - A button to request a new verification email
 * - Success/error feedback via Snackbar notifications
 * - Option to dismiss the notice
 *
 * The component automatically hides itself when:
 * - User is not authenticated
 * - User's email is already verified
 * - User has dismissed the notice
 */
const EmailVerificationNotice: React.FC = () => {
  const { user, isAuthenticated } = useAuth0();
  const { t } = useTranslation();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { resendVerificationEmail } = useUserVerification();

  // Don't show if user is not authenticated, email is already verified, or notice is dismissed
  if (!isAuthenticated || !user || user.email_verified || isDismissed) {
    return null;
  }

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail();
      setShowSuccess(true);
    } catch (error) {
      console.error('Error resending verification email:', error);
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

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          top: 80, // Position below header
          right: 16,
          zIndex: 1000,
          maxWidth: 400,
          width: '100%',
        }}
      >
        <Alert
          severity="info"
          variant="outlined"
          icon={<Email />}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="text"
                size="small"
                onClick={handleResendEmail}
                disabled={isResending}
                sx={{
                  color: 'primary.main',
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText',
                  },
                }}
              >
                {isResending
                  ? t('common.loading')
                  : t('auth.emailVerification.resendButton')}
              </Button>
              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{
                  color: 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{
            backgroundColor: 'background.paper',
            borderColor: 'info.light',
            boxShadow: 2,
            '& .MuiAlert-message': {
              width: '100%',
            },
            '& .MuiAlert-icon': {
              color: 'info.main',
            },
          }}
        >
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={500}
              gutterBottom
              sx={{ color: 'text.primary' }}
            >
              {t('auth.emailVerification.title')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.875rem',
                lineHeight: 1.4,
              }}
            >
              {t('auth.emailVerification.message', { email: user.email })}
            </Typography>
          </Box>
        </Alert>
      </Box>

      <Snackbar
        open={showSuccess}
        autoHideDuration={4000}
        onClose={handleCloseSuccess}
        message={t('auth.emailVerification.resendSuccess')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Snackbar
        open={showError}
        autoHideDuration={4000}
        onClose={handleCloseError}
        message={t('auth.emailVerification.resendError')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default EmailVerificationNotice;
