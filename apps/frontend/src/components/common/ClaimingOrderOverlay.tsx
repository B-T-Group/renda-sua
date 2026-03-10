import { LocalShipping } from '@mui/icons-material';
import { Backdrop, Box, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.9; }
`;

const ring = keyframes`
  0% { transform: scale(0.8); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 0.2; }
  100% { transform: scale(0.8); opacity: 0.6; }
`;

const dotPulse = keyframes`
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
`;

interface ClaimingOrderOverlayProps {
  open: boolean;
}

const ClaimingOrderOverlay: React.FC<ClaimingOrderOverlayProps> = ({ open }) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <Backdrop
      sx={{
        zIndex: (theme) => theme.zIndex.modal + 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      open={open}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          color: 'white',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '3px solid',
              borderColor: 'primary.main',
              opacity: 0.4,
              animation: `${ring} 1.5s ease-in-out infinite`,
            }}
          />
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              boxShadow: 4,
              animation: `${pulse} 1.2s ease-in-out infinite`,
            }}
          >
            <LocalShipping
              sx={{ fontSize: 36, color: 'primary.contrastText' }}
            />
          </Box>
        </Box>

        <Typography
          variant="h6"
          fontWeight={600}
          color="inherit"
          component="span"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
        >
          {t('orders.claimingOrder', 'Claiming order')}
          <Box component="span" sx={{ display: 'inline-flex' }}>
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                component="span"
                sx={{
                  animation: `${dotPulse} 1.4s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              >
                .
              </Box>
            ))}
          </Box>
        </Typography>
        <Typography variant="body2" color="grey.300">
          {t('orders.claimingOrderHint', 'Please wait, do not close this page')}
        </Typography>
      </Box>
    </Backdrop>
  );
};

export default ClaimingOrderOverlay;
