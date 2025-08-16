import { Description, Home as HomeIcon, Message } from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export interface AdminAccount {
  id: string;
  currency: string;
  total_balance: number;
  available_balance?: number;
  withheld_balance?: number;
}

export interface AdminAddress {
  id: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface AdminUserCardProps {
  title: string;
  subtitle?: string;
  accounts?: AdminAccount[];
  addresses?: AdminAddress[];
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
  verified?: boolean;
  admin?: boolean;
  userId?: string;
  userType?: 'agent' | 'client' | 'business';
}

const AdminUserCard: React.FC<AdminUserCardProps> = ({
  title,
  subtitle,
  accounts = [],
  addresses = [],
  footer,
  headerRight,
  verified,
  admin,
  userId,
  userType,
}) => {
  return (
    <Card sx={{ p: 2, width: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {verified && <StatusBadge type="verified" />}
            {admin && <StatusBadge type="admin" />}
            {headerRight}
          </Box>
        </Box>

        {!!accounts?.length && (
          <Box>
            <Typography variant="subtitle2">Accounts</Typography>
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}
            >
              {accounts.map((acc) => (
                <Box
                  key={acc.id}
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <Chip label={acc.currency} size="small" />
                  {typeof acc.available_balance === 'number' && (
                    <Chip
                      label={`Available: ${acc.available_balance}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {typeof acc.withheld_balance === 'number' && (
                    <Chip
                      label={`Withheld: ${acc.withheld_balance}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    label={`Total: ${acc.total_balance}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {!!addresses?.length && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <HomeIcon fontSize="small" /> Addresses
            </Typography>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {addresses.map((addr) => (
                <Typography
                  key={addr.id}
                  variant="body2"
                  color="text.secondary"
                >
                  {addr.address_line_1}
                  {addr.address_line_2 ? `, ${addr.address_line_2}` : ''},{' '}
                  {addr.city}, {addr.state} {addr.postal_code}, {addr.country}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {footer && <Box sx={{ mt: 1 }}>{footer}</Box>}
        
        {/* Admin Action Buttons */}
        {userId && userType && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Admin Actions
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                component={RouterLink}
                to={`/admin/${userType}s/${userId}/documents`}
                size="small"
                variant="outlined"
                startIcon={<Description />}
              >
                Documents
              </Button>
              <Button
                component={RouterLink}
                to={`/admin/${userType}s/${userId}/messages`}
                size="small"
                variant="outlined"
                startIcon={<Message />}
              >
                Messages
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUserCard;
