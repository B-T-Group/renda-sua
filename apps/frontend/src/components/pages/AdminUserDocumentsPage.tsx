import { ArrowBack, Description } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useAdminUserUploads } from '../../hooks/useAdminUserUploads';
import { useUserDetails } from '../../hooks/useUserDetails';
import { useUserProfile } from '../../hooks/useUserProfile';
import AdminUserUploadList from '../common/AdminUserUploadList';

const AdminUserDocumentsPage: React.FC = () => {
  const { userType, userId } = useParams<{
    userType: string;
    userId: string;
  }>();
  const { profile: currentUser } = useUserProfile();
  const { loading: userLoading, userName } = useUserDetails(userId || '');
  const {
    uploads,
    loading: uploadsLoading,
    error: uploadsError,
    pagination,
    refetch,
    loadPage,
  } = useAdminUserUploads(userId || '');

  // Check if current user is admin
  const isAdmin =
    currentUser?.user_type_id === 'business' && currentUser?.business?.is_admin;

  if (!isAdmin) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" color="error">
            Access Denied
          </Typography>
          <Typography>You don't have permission to view this page.</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Button
            component={RouterLink}
            to={`/admin/${userType}s`}
            startIcon={<ArrowBack />}
            variant="outlined"
          >
            Back to {userType}s
          </Button>
          <Box>
            <Typography
              variant="h4"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Description />
              {userName}'s Documents
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage documents for {userName || `${userType} ${userId}`}
            </Typography>
          </Box>
        </Box>

        {/* Uploads List */}
        <Card>
          <CardContent>
            {userLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <AdminUserUploadList
                uploads={uploads}
                loading={uploadsLoading}
                error={uploadsError}
                pagination={pagination}
                onLoadPage={loadPage}
                onRefresh={refetch}
              />
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default AdminUserDocumentsPage;
