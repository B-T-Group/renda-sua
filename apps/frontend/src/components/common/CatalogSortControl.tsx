import React, { useState, useRef } from 'react';
import { 
  Box, 
  IconButton, 
  Menu, 
  MenuItem, 
  Chip, 
  Radio,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { Sort as SortIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { InventorySortMode } from '../../hooks/useInventoryItems';

export interface CatalogSortControlProps {
  currentSort: InventorySortMode;
  defaultSort: InventorySortMode;
  isSearchMode: boolean;
  controlState: 'enabled' | 'disabled' | 'hidden';
  onSortChange: (sort: InventorySortMode) => void;
  onSortMenuOpen?: () => void;
}

export const CatalogSortControl: React.FC<CatalogSortControlProps> = ({
  currentSort,
  defaultSort,
  isSearchMode,
  controlState,
  onSortChange,
  onSortMenuOpen,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (controlState === 'hidden') {
    return null;
  }

  const open = Boolean(anchorEl);

  const browseOptions: InventorySortMode[] = ['recommended', 'popular', 'rating', 'newest'];
  const searchOptions: InventorySortMode[] = ['relevance', 'popular', 'rating', 'newest'];
  const options = isSearchMode ? searchOptions : browseOptions;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (controlState === 'disabled') return;
    setAnchorEl(event.currentTarget);
    onSortMenuOpen?.();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSortSelect = (sort: InventorySortMode) => {
    onSortChange(sort);
    handleClose();
  };

  const getSortLabel = (sort: InventorySortMode): string => {
    return t(`catalog.sortModes.${sort}`, sort);
  };

  const showChip = currentSort !== defaultSort;
  const ariaLabel = t('catalog.sort', { mode: getSortLabel(currentSort) });

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton
        ref={buttonRef}
        onClick={handleClick}
        disabled={controlState === 'disabled'}
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        size="small"
        sx={{
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        <SortIcon />
      </IconButton>
      {showChip && (
        <Chip
          label={getSortLabel(currentSort)}
          size="small"
          variant="outlined"
          sx={{
            height: 24,
            fontSize: '0.8125rem',
          }}
        />
      )}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            minWidth: 200,
            mt: 1,
          },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {t('catalog.sortBy', 'Sort by')}
          </Typography>
        </Box>
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup
            aria-label={t('catalog.sortBy', 'Sort by')}
            value={currentSort}
            onChange={(e) => handleSortSelect(e.target.value as InventorySortMode)}
          >
            {options.map((option) => (
              <MenuItem
                key={option}
                onClick={() => handleSortSelect(option)}
                selected={currentSort === option}
                sx={{ py: 1 }}
              >
                <FormControlLabel
                  value={option}
                  control={<Radio size="small" />}
                  label={getSortLabel(option)}
                  sx={{ width: '100%', m: 0 }}
                />
              </MenuItem>
            ))}
          </RadioGroup>
        </FormControl>
      </Menu>
    </Box>
  );
};

export default CatalogSortControl;
