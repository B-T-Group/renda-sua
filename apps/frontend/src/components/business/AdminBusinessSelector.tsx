import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminBusinessOptions } from '../../hooks/useAdminBusinessOptions';
import type { AdminBusinessOption } from '../../hooks/useAdminBusinessOptions';

interface AdminBusinessSelectorProps {
  selectedBusinessId?: string;
  ownBusinessId?: string;
  ownBusinessName?: string;
  isViewingOtherBusiness?: boolean;
  onChange: (businessId: string, businessName: string) => void;
}

const AdminBusinessSelector: React.FC<AdminBusinessSelectorProps> = ({
  selectedBusinessId,
  ownBusinessId,
  ownBusinessName,
  isViewingOtherBusiness = false,
  onChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const { options, loading } = useAdminBusinessOptions(true, search);

  const ownBusinessLabel = t(
    'business.items.businessSelector.ownBusiness',
    'My business'
  );

  const allOptions = useMemo(() => {
    const map = new Map<string, AdminBusinessOption>();
    if (ownBusinessId) {
      map.set(ownBusinessId, {
        id: ownBusinessId,
        name: ownBusinessName || ownBusinessLabel,
      });
    }
    for (const opt of options) {
      map.set(opt.id, opt);
    }
    return Array.from(map.values());
  }, [options, ownBusinessId, ownBusinessName, ownBusinessLabel]);

  const selectedOption =
    allOptions.find((o) => o.id === selectedBusinessId) ?? null;

  const handleResetToOwn = () => {
    if (!ownBusinessId) return;
    onChange(ownBusinessId, ownBusinessName || ownBusinessLabel);
    setSearch('');
  };

  const isOwnSelected =
    !!ownBusinessId && selectedBusinessId === ownBusinessId;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        borderRadius: 0,
        bgcolor: isViewingOtherBusiness
          ? alpha(theme.palette.info.main, 0.08)
          : 'background.paper',
        borderColor: isViewingOtherBusiness
          ? alpha(theme.palette.info.main, 0.35)
          : 'divider',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 1.25, md: 2 }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              flexShrink: 0,
              bgcolor: isViewingOtherBusiness ? 'info.main' : 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {isViewingOtherBusiness ? (
              <BusinessOutlinedIcon fontSize="small" />
            ) : (
              <AdminPanelSettingsOutlinedIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2" fontWeight={600} lineHeight={1.3}>
                {t(
                  'business.items.businessSelector.title',
                  'Catalog scope'
                )}
              </Typography>
              <Chip
                size="small"
                label={t('business.items.businessSelector.adminBadge', 'Admin')}
                color="primary"
                variant="outlined"
                sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              {isViewingOtherBusiness
                ? t(
                    'business.items.businessSelector.viewingOtherHint',
                    'You are managing another business’s inventory'
                  )
                : t(
                    'business.items.businessSelector.ownHint',
                    'Your catalog — switch to manage another business'
                  )}
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ width: { xs: '100%', md: 'auto' }, flex: { md: 1 }, maxWidth: { md: 520 } }}
        >
          <Autocomplete
            size="small"
            fullWidth
            disableClearable
            openOnFocus
            options={allOptions}
            value={selectedOption}
            loading={loading}
            filterOptions={(x) => x}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, value) => {
              if (value) onChange(value.id, value.name);
            }}
            onInputChange={(_, value, reason) => {
              if (reason === 'input') setSearch(value);
              if (reason === 'clear') setSearch('');
            }}
            noOptionsText={t(
              'business.items.businessSelector.noResults',
              'No businesses found'
            )}
            loadingText={t(
              'business.items.businessSelector.loading',
              'Loading businesses…'
            )}
            renderOption={(props, option) => {
              const isOwn = option.id === ownBusinessId;
              return (
                <Box component="li" {...props} key={option.id}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                    sx={{ width: '100%' }}
                  >
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                      {option.name}
                    </Typography>
                    {isOwn && (
                      <Chip
                        size="small"
                        label={ownBusinessLabel}
                        color="primary"
                        variant="outlined"
                        sx={{ height: 22, flexShrink: 0 }}
                      />
                    )}
                  </Stack>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t(
                  'business.items.businessSelector.placeholder',
                  'Search by business name…'
                )}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <BusinessOutlinedIcon
                        fontSize="small"
                        color="action"
                        sx={{ ml: 0.5, mr: -0.25 }}
                      />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {loading ? (
                        <CircularProgress color="inherit" size={18} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: 'background.paper' },
            }}
          />

          {isViewingOtherBusiness && ownBusinessId && (
            <Tooltip
              title={t(
                'business.items.businessSelector.backToOwn',
                'Back to my business'
              )}
            >
              <IconButton
                size="small"
                onClick={handleResetToOwn}
                aria-label={t(
                  'business.items.businessSelector.backToOwn',
                  'Back to my business'
                )}
                sx={{
                  flexShrink: 0,
                  borderRadius: 0,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {selectedOption && !isOwnSelected && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('business.items.businessSelector.activeScope', 'Active scope:')}
          </Typography>
          <Chip
            size="small"
            icon={<BusinessOutlinedIcon />}
            label={selectedOption.name}
            color="info"
            variant="filled"
            sx={{ height: 24, borderRadius: 0 }}
          />
        </Stack>
      )}
    </Paper>
  );
};

export default AdminBusinessSelector;
