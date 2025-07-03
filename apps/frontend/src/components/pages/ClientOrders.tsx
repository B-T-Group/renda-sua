import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  LocalShipping as LocalShippingIcon,
  Schedule as ScheduleIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useGraphQLRequest } from '../../hooks/useGraphQLRequest';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  current_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  estimated_delivery_time?: string;
  actual_delivery_time?: string;
  special_instructions?: string;
  order_items: OrderItem[];
  business: {
    name: string;
  };
  business_location: {
    address: {
      street_address: string;
      city: string;
      state: string;
      country: string;
    };
  };
}

const GET_CLIENT_ORDERS = `
  query GetClientOrders {
    orders {
      id
      order_number
      current_status
      total_amount
      currency
      created_at
      estimated_delivery_time
      actual_delivery_time
      special_instructions
      order_items {
        id
        item_name
        quantity
        unit_price
        total_price
      }
      business {
        name
      }
      business_location {
        address {
          address_line_1
          address_line_2
          city
          state
          country
        }
      }
    }
  }
`;

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'warning';
    case 'confirmed':
      return 'info';
    case 'processing':
      return 'primary';
    case 'shipped':
      return 'secondary';
    case 'delivered':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return <ScheduleIcon />;
    case 'confirmed':
      return <CheckCircleIcon />;
    case 'processing':
      return <ShoppingCartIcon />;
    case 'shipped':
      return <LocalShippingIcon />;
    case 'delivered':
      return <CheckCircleIcon />;
    case 'cancelled':
      return <CancelIcon />;
    default:
      return <ShoppingCartIcon />;
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

export const ClientOrders: React.FC = () => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const { data, loading, error, refetch } = useGraphQLRequest<{
    orders: Order[];
  }>(GET_CLIENT_ORDERS);

  const handleExpandOrder = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading orders:{' '}
          {typeof error === 'string' ? error : error.message}
        </Alert>
      </Container>
    );
  }

  const orders = data?.orders || [];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        My Orders
      </Typography>

      {orders.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ShoppingCartIcon
            sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }}
          />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No orders found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            You haven't placed any orders yet. Start shopping to see your orders
            here.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {orders.map((order) => (
            <Grid key={order.id} xs={12}>
              <Card>
                <CardContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={2}
                  >
                    <Box>
                      <Typography variant="h6" component="h2" gutterBottom>
                        Order #{order.order_number}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Placed on {formatDate(order.created_at)}
                      </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={2}>
                      <Chip
                        icon={getStatusIcon(order.current_status)}
                        label={order.current_status}
                        color={getStatusColor(order.current_status) as any}
                        variant="outlined"
                      />
                      <Typography variant="h6" color="primary">
                        {formatCurrency(order.total_amount, order.currency)}
                      </Typography>
                      <IconButton
                        onClick={() => handleExpandOrder(order.id)}
                        size="small"
                      >
                        {expandedOrder === order.id ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </Box>
                  </Box>

                  <Box mb={2}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Business:</strong> {order.business.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Location:</strong>{' '}
                      {order.business_location?.address?.street_address ||
                        'N/A'}
                      , {order.business_location?.address?.city || 'N/A'},{' '}
                      {order.business_location?.address?.state || 'N/A'},{' '}
                      {order.business_location?.address?.country || 'N/A'}
                    </Typography>
                  </Box>

                  <Collapse in={expandedOrder === order.id}>
                    <Divider sx={{ my: 2 }} />

                    <Typography variant="h6" gutterBottom>
                      Order Items
                    </Typography>
                    <List dense>
                      {order.order_items.map((item) => (
                        <ListItem key={item.id} sx={{ pl: 0 }}>
                          <ListItemText
                            primary={item.item_name}
                            secondary={`Quantity: ${
                              item.quantity
                            } × ${formatCurrency(
                              item.unit_price,
                              order.currency
                            )}`}
                          />
                          <ListItemSecondaryAction>
                            <Typography variant="body2" color="primary">
                              {formatCurrency(item.total_price, order.currency)}
                            </Typography>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                    </List>

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={2}>
                      <Grid xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Estimated Delivery
                        </Typography>
                        <Typography variant="body2">
                          {order.estimated_delivery_time
                            ? formatDate(order.estimated_delivery_time)
                            : 'Not specified'}
                        </Typography>
                      </Grid>
                      <Grid xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Actual Delivery
                        </Typography>
                        <Typography variant="body2">
                          {order.actual_delivery_time
                            ? formatDate(order.actual_delivery_time)
                            : 'Not delivered yet'}
                        </Typography>
                      </Grid>
                    </Grid>

                    {order.special_instructions && (
                      <>
                        <Divider sx={{ my: 2 }} />
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          gutterBottom
                        >
                          Special Instructions
                        </Typography>
                        <Typography variant="body2">
                          {order.special_instructions}
                        </Typography>
                      </>
                    )}
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};
