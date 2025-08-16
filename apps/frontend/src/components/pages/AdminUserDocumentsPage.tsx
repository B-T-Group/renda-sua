import React, { useEffect, useState } from 'react';
import {
  ArrowBack,
  Description,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Typography,
} from '@mui/material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useDocumentManagement } from '../../hooks/useDocumentManagement';
import { useUserProfile } from '../../hooks/useUserProfile';
import { DocumentList } from '../common/DocumentList';

const AdminUserDocumentsPage: React.FC = () => {
  const { userType, userId } = useParams<{ userType: string; userId: string }>();
  const { profile: currentUser } = useUserProfile();
  const [userName, setUserName] = useState<string>('');

  // Check if current user is admin
  const isAdmin = currentUser?.user_type_id === 'business' && currentUser?.business?.is_admin;

  useEffect(() => {
    // Set user name based on user type
    if (userType && userId) {
      // This would typically come from an API call to get user details
      setUserName(`User ${userId}`);
    }
  }, [userType, userId]);

  if (!isAdmin) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ py: 4 }}>
          <Typography variant="h4" color="error">
            Access Denied
          </Typography>
          <Typography>
            You don't have permission to view this page.
          </Typography>
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
            <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description />
              {userName}'s Documents
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage documents for {userType}: {userId}
            </Typography>
          </Box>
        </Box>

        {/* Documents List */}
        <Card>
          <CardContent>
            <DocumentList 
              userId={userId}
              showUserInfo={false}
            />
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
};

export default AdminUserDocumentsPage;
