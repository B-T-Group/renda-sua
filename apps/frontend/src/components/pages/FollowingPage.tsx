import { Alert, Box, Button, CircularProgress, Container, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';

type FollowedBusiness = { id: string; name: string; followers_count: number; following: boolean };

/** Stores the signed-in shopper follows. */
export default function FollowingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const [rows, setRows] = useState<FollowedBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiClient
      .get<{ data?: { businesses?: FollowedBusiness[] } }>('/business-follows?page=1&limit=50')
      .then((response) => {
        if (cancelled) return;
        setRows((response.data?.data?.businesses ?? []).filter((row) => row.following));
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError(t('client.following.error', 'Something went wrong while loading stores you follow.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiClient, t]);

  if (loading) {
    return (
      <Container sx={{ py: 6, textAlign: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h2" component="h1" gutterBottom>
        {t('client.following.title', 'Following')}
      </Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {rows.length === 0 && !error ? (
        <Box>
          <Typography variant="body1" color="text.secondary">
            {t('client.following.emptyBody', 'Follow a store to find it again here.')}
          </Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/stores')}>
            {t('client.following.browse', 'Browse stores')}
          </Button>
        </Box>
      ) : (
        <List>
          {rows.map((row) => (
            <ListItemButton key={row.id} onClick={() => navigate(`/store/${row.id}`)}>
              <ListItemText
                primary={row.name}
                secondary={t('client.following.followers', '{{count}} followers', { count: row.followers_count })}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Container>
  );
}
