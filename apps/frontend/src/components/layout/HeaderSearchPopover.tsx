import SearchIcon from '@mui/icons-material/Search';
import { Box, InputBase, List, ListItemButton, ListItemText } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useInventorySearchSuggestions } from '../../hooks/useInventorySearchSuggestions';

/** Header search that opens suggestion results without leaving the current page. */
export function HeaderSearchPopover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { suggestions } = useInventorySearchSuggestions({ q: query }, { enabled: open });
  const visible = open && query.trim().length >= 2 && suggestions.length > 0;

  const choose = (inventoryId: string | null, term: string) => {
    setOpen(false);
    setQuery('');
    if (inventoryId) {
      navigate(`/items/${inventoryId}`);
      return;
    }
    navigate(`/items?q=${encodeURIComponent(term)}`);
  };

  return (
    <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' }, width: 220 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          borderRadius: 999,
          bgcolor: 'rgba(255,255,255,0.12)',
          minHeight: 36,
        }}
      >
        <SearchIcon sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 18 }} />
        <InputBase
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          placeholder={t('client.search.placeholder', 'Search products')}
          inputProps={{ 'aria-label': t('client.search.placeholder', 'Search products') }}
          sx={{ color: '#fff', fontSize: 14, flex: 1 }}
        />
      </Box>
      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 20 }}
          >
            <List dense sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 3, py: 0.5 }}>
              {suggestions.slice(0, 6).map((suggestion) => {
                const label =
                  suggestion.kind === 'product'
                    ? suggestion.title
                    : suggestion.kind === 'seller'
                      ? suggestion.name
                      : suggestion.value;
                const id = suggestion.kind === 'product' ? suggestion.inventoryId : null;
                return (
                  <ListItemButton key={`${suggestion.kind}-${label}`} onMouseDown={() => choose(id, label)}>
                    <ListItemText primary={label} />
                  </ListItemButton>
                );
              })}
            </List>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Box>
  );
}
