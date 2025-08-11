import { Home as HomeIcon } from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from '@mui/material';
import React from 'react';

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
}

const AdminUserCard: React.FC<AdminUserCardProps> = ({
  title,
  subtitle,
  accounts = [],
  addresses = [],
  footer,
  headerRight,
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
          {headerRight}
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
      </CardContent>
    </Card>
  );
};

export default AdminUserCard;
