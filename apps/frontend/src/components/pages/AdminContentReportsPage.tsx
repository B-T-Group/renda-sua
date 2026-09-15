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

type ContentReportRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

const AdminContentReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const api = useApiClient();
  const isAdmin = usePermission(PlatformPermissions.MODERATE_ITEMS);
  const [rows, setRows] = useState<ContentReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: { rows: ContentReportRow[] };
      }>('/content-reports/admin/queue?status=pending&limit=50');
      setRows(res.data?.data?.rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const resolve = async (
    id: string,
    action: 'dismiss' | 'hide_content' | 'warn_merchant'
  ) => {
    await api.patch(`/content-reports/admin/${id}/resolve`, { action });
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (!isAdmin) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography>{t('admin.accessDenied', 'Access denied')}</Typography>
      </Container>
    );
  }

  return (
    <Container sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('admin.contentReports.title', 'Content reports')}
      </Typography>
      {loading ? (
        <CircularProgress />
      ) : rows.length === 0 ? (
        <Typography>{t('admin.contentReports.empty', 'No pending reports')}</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent>
                <Typography variant="subtitle1">
                  {row.subject_type} · {row.reason}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {row.details || row.subject_id}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => void resolve(row.id, 'dismiss')}>
                    {t('admin.contentReports.dismiss', 'Dismiss')}
                  </Button>
                  <Button size="small" onClick={() => void resolve(row.id, 'hide_content')}>
                    {t('admin.contentReports.hide', 'Hide content')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Container>
  );
};

export default AdminContentReportsPage;
