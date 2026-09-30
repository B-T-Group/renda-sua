import { Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export function CategoryBrowseEmpty({ searching }: { searching: boolean }) {
  const { t } = useTranslation();
  const title = searching
    ? t('public.items.categoriesPage.emptySearch', 'No categories match that search')
    : t('public.items.categoriesPage.empty', 'No categories in this market yet');
  return (
    <Box sx={{ py: 6, textAlign: 'center' }}>
      <EmptyCategoriesMark />
      <Typography fontWeight={700} sx={{ mt: 2 }}>
        {title}
      </Typography>
    </Box>
  );
}

function EmptyCategoriesMark() {
  return (
    <Box component="svg" viewBox="0 0 120 80" sx={{ width: 120, height: 80 }} aria-hidden>
      <rect x="8" y="10" width="46" height="60" rx="10" fill="#E7EEF8" />
      <rect x="66" y="10" width="46" height="28" rx="10" fill="#D7E4F6" />
      <rect x="66" y="44" width="46" height="26" rx="10" fill="#C5D7F2" />
    </Box>
  );
}
