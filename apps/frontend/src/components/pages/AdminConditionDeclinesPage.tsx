import { Box, CircularProgress, Container } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useApiClient } from '../../hooks/useApiClient';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    void api
      .get('/admin/rentals/condition-declines')
      .then((res) => {
        const parties = res.data?.parties ?? [];
        if (!stop) setRows(Array.isArray(parties) ? parties : []);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
    return () => {
      stop = true;
    };
  }, [api]);

  if (loading) return <CircularProgress sx={{ m: 4 }} />;
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box>
        <DeclineAdminTable rows={rows} timeZone="Africa/Douala" />
      </Box>
    </Container>
  );
};

export default AdminConditionDeclinesPage;
