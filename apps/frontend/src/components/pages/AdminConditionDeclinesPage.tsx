import { Box, CircularProgress, Container, Stack } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClient } from '../../hooks/useApiClient';
import { DeclineExclusionPanel, type DeclineExclusionRow } from '../rentals/DeclineExclusionPanel';
import { DeclineAdminTable } from '../rentals/DeclinePickupScreens';

interface DeclineRow {
  name: string;
  role: 'renter' | 'business';
  declineCount: number;
  pickupsReached: number | null;
  lastDeclineAt: string;
  flagged: boolean;
}

const AdminConditionDeclinesPage: React.FC = () => {
  const api = useApiClient();
  const [rows, setRows] = useState<DeclineRow[]>([]);
  const [exclusions, setExclusions] = useState<DeclineExclusionRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadExclusions = useCallback(async () => {
    try {
      const res = await api.get('/admin/rentals/condition-exclusions');
      setExclusions(Array.isArray(res.data?.rows) ? res.data.rows : []);
    } catch (error: any) {
      if (error?.response?.status === 404) setExclusions(null);
    }
  }, [api]);

  useEffect(() => {
    let stop = false;
    void api
      .get('/admin/rentals/condition-declines')
      .then((res) => {
        const parties = res.data?.parties ?? [];
        if (!stop) setRows(Array.isArray(parties) ? parties : []);
      })
      .catch(() => setRows([]))
      .finally(() => {
        if (!stop) setLoading(false);
      });
    void loadExclusions();
    return () => {
      stop = true;
    };
  }, [api, loadExclusions]);

  const onExclusion = async (row: DeclineExclusionRow, excluded: boolean, note: string) => {
    await api.post(`/admin/rentals/bookings/${row.bookingId}/condition-exclusion`, { excluded, note });
    await loadExclusions();
  };

  if (loading) return <CircularProgress sx={{ m: 4 }} />;
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={4}>
        <DeclineAdminTable rows={rows} timeZone="Africa/Douala" />
        {exclusions ? (
          <Box>
            <DeclineExclusionPanel rows={exclusions} onChange={(row, excluded, note) => void onExclusion(row, excluded, note)} />
          </Box>
        ) : null}
      </Stack>
    </Container>
  );
};

export default AdminConditionDeclinesPage;
