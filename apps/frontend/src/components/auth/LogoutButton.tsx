import { Logout } from '@mui/icons-material';
import { Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';

const LogoutButton = () => {
  const { logout } = useSessionAuth();
  const { t } = useTranslation();

  return (
    <Button
      variant="contained"
      color="error"
      startIcon={<Logout />}
      onClick={() => logout()}
      size="medium"
      sx={{
        bgcolor: '#dc2626',
        color: 'white',
        border: '1px solid #dc2626',
        '&:hover': {
          bgcolor: '#b91c1c',
          border: '1px solid #b91c1c',
        },
        fontWeight: 500,
        textTransform: 'none',
        px: 2,
        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
      }}
    >
      {t('auth.logout', 'Log out')}
    </Button>
  );
};

export default LogoutButton;
