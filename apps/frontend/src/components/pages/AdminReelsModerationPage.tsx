import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlatformPermissions } from '../../constants/platformPermissions';
import { usePermission } from '../../hooks/usePermissions';
import { useApiClient } from '../../hooks/useApiClient';

type ReelRow = {
  id: string;
  caption: string | null;
  moderation_status: string;
  thumbnail_url: string | null;
};

const AdminReelsModerationPage: React.FC = () => {
  const { t } = useTranslation();
  const api = useApiClient();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const [rows, setRows] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ReelRow[]>('/admin/reels/moderation?limit=50');
      const body = res.data as ReelRow[] | { data?: ReelRow[] };
      setRows(Array.isArray(body) ? body : body?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const moderate = async (id: string, status: 'approved' | 'rejected') => {
    await api.patch(`/admin/reels/${id}/moderation`, {
      status,
      reason: status === 'rejected' ? 'Policy' : undefined,
    });
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (!isAdmin) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('admin.accessDenied', 'Access denied')}</Typography>
      </Container>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        {t('admin.reels.moderation.title', 'Reel moderation')}
      </Typography>
      {rows.length === 0 ? (
        <Typography>{t('admin.reels.moderation.empty', 'No reels awaiting review')}</Typography>
      ) : (
        rows.map((row) => (
          <Card key={row.id} sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1">{row.caption || row.id}</Typography>
              <Typography variant="body2" color="text.secondary">
                {row.moderation_status}
              </Typography>
              <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => void moderate(row.id, 'approved')}>
                  {t('admin.reels.moderation.approve', 'Approve')}
                </Button>
                <Button size="small" color="error" onClick={() => void moderate(row.id, 'rejected')}>
                  {t('admin.reels.moderation.reject', 'Reject')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ))
      )}
    </Container>
  );
};

export default AdminReelsModerationPage;
