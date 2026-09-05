import { Box, Paper } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface BottomNavTab {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  active: boolean;
}

interface BottomNavBarProps {
  tabs: BottomNavTab[];
}

/**
 * Shared mobile tab bar. Personas differ only in their tabs, so the bar itself
 * lives here rather than being copied per persona.
 */
const BottomNavBar: React.FC<BottomNavBarProps> = ({ tabs }) => {
  const navigate = useNavigate();

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        borderRadius: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        display: { xs: 'block', md: 'none' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          height: 64,
          alignItems: 'center',
          justifyContent: 'space-around',
        }}
      >
        {tabs.map((tab) => (
          <Box
            key={tab.key}
            role="button"
            aria-current={tab.active ? 'page' : undefined}
            onClick={() => navigate(tab.path)}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              cursor: 'pointer',
              minHeight: 48,
              color: tab.active ? 'primary.main' : 'text.secondary',
              backgroundColor: 'transparent',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { backgroundColor: 'action.hover' },
              '&:active': { backgroundColor: 'action.hover' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                '& .MuiSvgIcon-root': {
                  fontSize: 24,
                  color: tab.active ? 'primary.main' : 'text.secondary',
                },
              }}
            >
              {tab.icon}
            </Box>
            <Box
              component="span"
              sx={{
                fontSize: '0.75rem',
                fontWeight: tab.active ? 600 : 400,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {tab.label}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default BottomNavBar;
