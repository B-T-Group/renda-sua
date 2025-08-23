import { CheckCircle, LocalShipping, Store } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface OrderConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber?: string;
}

const OrderConfirmationModal: React.FC<OrderConfirmationModalProps> = ({
  open,
  onClose,
  orderNumber,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleViewOrders = () => {
    onClose();
    navigate('/orders');
  };

  const handleContinueShopping = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CheckCircle color="success" />
          <Typography variant="h6">
            {t('client.orders.confirmation.title')}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            {orderNumber && (
              <>
                {t('client.orders.confirmation.orderPlaced', { orderNumber })}
                <br />
              </>
            )}
            {t('client.orders.confirmation.thankYou')}
          </Typography>
        </Box>

        <Typography variant="h6" gutterBottom>
          {t('client.orders.confirmation.whatToExpect')}
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <Store color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t('client.orders.confirmation.step1.title')}
              secondary={t('client.orders.confirmation.step1.description')}
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <LocalShipping color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t('client.orders.confirmation.step2.title')}
              secondary={t('client.orders.confirmation.step2.description')}
            />
          </ListItem>
        </List>

        <Box
          sx={{
            p: 2,
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            borderRadius: 1,
            mt: 2,
            border: '1px solid',
            borderColor: 'info.main',
          }}
        >
          <Typography
            variant="subtitle2"
            gutterBottom
            sx={{
              color: '#1976d2',
              fontWeight: 'bold',
            }}
          >
            {t('client.orders.confirmation.tracking.title')}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: '#424242',
              fontWeight: 500,
              lineHeight: 1.6,
            }}
          >
            {t('client.orders.confirmation.tracking.description')}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={handleContinueShopping} variant="outlined">
          {t('client.orders.confirmation.continueShopping')}
        </Button>
        <Button onClick={handleViewOrders} variant="contained">
          {t('client.orders.confirmation.viewOrders')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderConfirmationModal;
