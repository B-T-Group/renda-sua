import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import type { ItemVariant } from '../../types/itemVariant';
import { primaryVariantImageUrl } from '../../types/itemVariant';

export interface CatalogOptionChipsProps {
  options: ItemVariant[];
  value: string | null;
  onChange: (optionId: string) => void;
  disabled?: boolean;
}

/** Compact horizontal option chips for catalog cards. */
export const CatalogOptionChips: React.FC<CatalogOptionChipsProps> = ({
  options,
  value,
  onChange,
  disabled,
}) => {
  if (options.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: options.length > 4 ? 'nowrap' : 'wrap',
        gap: 0.75,
        overflowX: options.length > 4 ? 'auto' : 'visible',
        pb: options.length > 4 ? 0.5 : 0,
        mt: 0.75,
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        const thumb = primaryVariantImageUrl(option);
        return (
          <ButtonBase
            key={option.id}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            aria-pressed={selected}
            aria-label={option.name}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              border: '1.5px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? 'action.selected' : 'background.paper',
              color: 'text.primary',
              flexShrink: 0,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            {thumb ? (
              <Box
                component="img"
                src={thumb}
                alt=""
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 0.5,
                  objectFit: 'cover',
                }}
              />
            ) : null}
            <Typography
              variant="caption"
              sx={{
                fontWeight: selected ? 700 : 500,
                fontSize: '0.7rem',
                maxWidth: 88,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {option.name}
            </Typography>
          </ButtonBase>
        );
      })}
    </Box>
  );
};

export default CatalogOptionChips;
