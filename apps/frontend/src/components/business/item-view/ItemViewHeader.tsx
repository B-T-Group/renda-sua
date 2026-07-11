import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ItemModerationStatusChip from '../ItemModerationStatusChip';

interface ItemViewHeaderProps {
  name: string;
  sku?: string | null;
  isActive: boolean;
  moderationStatus?: string | null;
  canToggleActive?: boolean;
  toggling: boolean;
  onToggleActive: (next: boolean) => void;
  onBack: () => void;
  onEdit: () => void;
}

const ItemViewHeader: React.FC<ItemViewHeaderProps> = ({
  name,
  sku,
  isActive,
  moderationStatus,
  canToggleActive = true,
  toggling,
  onToggleActive,
  onBack,
  onEdit,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        position: { md: 'sticky' },
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        py: 1.5,
        px: { xs: 1.5, md: 2 },
        mb: 3,
        borderRadius: 2,
        boxShadow: 1,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{ minWidth: 0, flex: 1 }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={onBack}
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
            sx={{ flexShrink: 0 }}
          >
            {t('common.back')}
          </Button>
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
            >
              <Typography
                variant="h5"
                component="h1"
                noWrap
                sx={{
                  fontSize: { xs: '1.15rem', md: '1.5rem' },
                  fontWeight: 700,
                }}
              >
                {name}
              </Typography>
              <ItemModerationStatusChip status={moderationStatus} />
            </Stack>
            {sku && (
              <Typography variant="body2" color="text.secondary" noWrap>
                SKU: {sku}
              </Typography>
            )}
          </Box>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ flexShrink: 0 }}
        >
          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(_, checked) => onToggleActive(checked)}
                disabled={toggling || !canToggleActive}
                color="success"
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                {t('business.items.listingActive', 'Listing active')}
              </Typography>
            }
            sx={{ ml: 0, mr: 0 }}
          />
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={onEdit}
            size={isMobile ? 'small' : 'medium'}
          >
            {t('business.inventory.editItemButton')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default ItemViewHeader;
