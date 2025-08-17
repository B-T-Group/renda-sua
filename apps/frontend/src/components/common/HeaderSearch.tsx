import { Search, Close } from '@mui/icons-material';
import {
  Box,
  IconButton,
  InputBase,
  Paper,
  Fade,
  ClickAwayListener,
} from '@mui/material';
import React, { useState, useRef } from 'react';
import { useItemSearch } from '../../hooks/useItemSearch';

interface HeaderSearchProps {
  onClose?: () => void;
}

const HeaderSearch: React.FC<HeaderSearchProps> = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { searchTerm, setSearchTerm, handleSearchSubmit, clearSearch } = useItemSearch();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchClick = () => {
    setIsExpanded(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleClose = () => {
    setIsExpanded(false);
    clearSearch();
    onClose?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      handleSearchSubmit(searchTerm);
      handleClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!isExpanded) {
    return (
      <IconButton
        size="small"
        onClick={handleSearchClick}
        sx={{
          color: '#1d1d1f',
          padding: '8px',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.04)',
          },
        }}
      >
        <Search fontSize="small" />
      </IconButton>
    );
  }

  return (
    <ClickAwayListener onClickAway={handleClose}>
      <Fade in={isExpanded}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: '280px', sm: '400px' },
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(251, 251, 253, 0.8)',
            backdropFilter: 'saturate(180%) blur(20px)',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '22px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
          elevation={0}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              pl: 2,
              pr: 1,
              width: '100%',
            }}
          >
            <Search
              sx={{
                color: '#86868b',
                fontSize: 20,
                mr: 1,
              }}
            />
            <InputBase
              ref={inputRef}
              placeholder="Search for items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{
                flex: 1,
                fontSize: '0.875rem',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                color: '#1d1d1f',
                '& .MuiInputBase-input': {
                  padding: 0,
                  '&::placeholder': {
                    color: '#86868b',
                    opacity: 1,
                  },
                },
              }}
              inputProps={{
                'aria-label': 'search items',
              }}
            />
            <IconButton
              size="small"
              onClick={handleClose}
              sx={{
                color: '#86868b',
                padding: '6px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </Fade>
    </ClickAwayListener>
  );
};

export default HeaderSearch;
