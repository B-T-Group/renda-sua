import { AccountBalance, Payment, Receipt, Refresh } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import {
  AirtelMoneyCollectionRequest,
  useAirtelMoney,
} from '../../hooks/useAirtelMoney';

const AirtelMoneyExample: React.FC = () => {
  const [paymentRequest, setPaymentRequest] =
    useState<AirtelMoneyCollectionRequest>({
      reference: `PAY_${Date.now()}`,
      subscriber: {
        country: 'UG',
        currency: 'UGX',
        msisdn: '',
      },
      transaction: {
        amount: '',
        country: 'UG',
        currency: 'UGX',
        id: `TXN_${Date.now()}`,
      },
    });

  const [transactionId, setTransactionId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  const {
    loading,
    error,
    requestPayment,
    getTransactionStatus,
    refundTransaction,
    getAccountBalance,
    clearError,
  } = useAirtelMoney();

  const [transactionStatus, setTransactionStatus] = useState<any>(null);
  const [accountBalance, setAccountBalance] = useState<any>(null);

  const handleRequestPayment = async () => {
    try {
      const result = await requestPayment(paymentRequest);
      if (result.status) {
        setTransactionId(result.transactionId || '');
        alert(
          `Payment request initiated! Transaction ID: ${result.transactionId}`
        );
      } else {
        alert(`Payment request failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Payment request error:', error);
    }
  };

  const handleGetTransactionStatus = async () => {
    if (!transactionId) {
      alert('Please enter a transaction ID');
      return;
    }

    try {
      const result = await getTransactionStatus(transactionId);
      if (result.status) {
        setTransactionStatus(result);
      } else {
        alert(`Failed to get status: ${result.error}`);
      }
    } catch (error) {
      console.error('Get status error:', error);
    }
  };

  const handleRefundTransaction = async () => {
    if (!transactionId || !refundAmount) {
      alert('Please enter transaction ID and refund amount');
      return;
    }

    try {
      const result = await refundTransaction(
        transactionId,
        refundAmount,
        refundReason
      );
      if (result.status) {
        alert(`Refund initiated! Reference: ${result.reference}`);
      } else {
        alert(`Refund failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Refund error:', error);
    }
  };

  const handleGetAccountBalance = async () => {
    try {
      const result = await getAccountBalance();
      if (result.status) {
        setAccountBalance(result.data);
      } else {
        alert(`Failed to get balance: ${result.error}`);
      }
    } catch (error) {
      console.error('Get balance error:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Airtel Money Integration Example
      </Typography>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Payment Request Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Payment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Request Payment
              </Typography>

              <TextField
                fullWidth
                label="Reference"
                value={paymentRequest.reference}
                onChange={(e) =>
                  setPaymentRequest((prev) => ({
                    ...prev,
                    reference: e.target.value,
                  }))
                }
                margin="normal"
              />

              <TextField
                fullWidth
                label="MSISDN (Phone Number)"
                value={paymentRequest.subscriber.msisdn}
                onChange={(e) =>
                  setPaymentRequest((prev) => ({
                    ...prev,
                    subscriber: {
                      ...prev.subscriber,
                      msisdn: e.target.value,
                    },
                  }))
                }
                margin="normal"
                placeholder="256700000000"
              />

              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={paymentRequest.transaction.amount}
                onChange={(e) =>
                  setPaymentRequest((prev) => ({
                    ...prev,
                    transaction: {
                      ...prev.transaction,
                      amount: e.target.value,
                    },
                  }))
                }
                margin="normal"
                placeholder="1000"
              />

              <Button
                fullWidth
                variant="contained"
                onClick={handleRequestPayment}
                disabled={loading}
                startIcon={
                  loading ? <CircularProgress size={20} /> : <Payment />
                }
                sx={{ mt: 2 }}
              >
                Request Payment
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Transaction Status Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Refresh sx={{ mr: 1, verticalAlign: 'middle' }} />
                Transaction Status
              </Typography>

              <TextField
                fullWidth
                label="Transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                margin="normal"
                placeholder="Enter transaction ID"
              />

              <Button
                fullWidth
                variant="outlined"
                onClick={handleGetTransactionStatus}
                disabled={loading || !transactionId}
                startIcon={
                  loading ? <CircularProgress size={20} /> : <Refresh />
                }
                sx={{ mt: 2 }}
              >
                Get Status
              </Button>

              {transactionStatus && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Transaction Details:
                  </Typography>
                  <Typography variant="body2">
                    ID: {transactionStatus.transactionId}
                  </Typography>
                  <Typography variant="body2">
                    Reference: {transactionStatus.reference}
                  </Typography>
                  <Typography variant="body2">
                    Amount: {transactionStatus.amount}{' '}
                    {transactionStatus.currency}
                  </Typography>
                  <Typography variant="body2">
                    Status: {transactionStatus.statusCode}
                  </Typography>
                  <Typography variant="body2">
                    Message: {transactionStatus.statusMessage}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Refund Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <Receipt sx={{ mr: 1, verticalAlign: 'middle' }} />
                Refund Transaction
              </Typography>

              <TextField
                fullWidth
                label="Transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                margin="normal"
                placeholder="Enter transaction ID to refund"
              />

              <TextField
                fullWidth
                label="Refund Amount"
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                margin="normal"
                placeholder="1000"
              />

              <TextField
                fullWidth
                label="Refund Reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                margin="normal"
                placeholder="Customer request"
              />

              <Button
                fullWidth
                variant="outlined"
                color="warning"
                onClick={handleRefundTransaction}
                disabled={loading || !transactionId || !refundAmount}
                startIcon={
                  loading ? <CircularProgress size={20} /> : <Receipt />
                }
                sx={{ mt: 2 }}
              >
                Refund Transaction
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Balance Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />
                Account Balance
              </Typography>

              <Button
                fullWidth
                variant="outlined"
                onClick={handleGetAccountBalance}
                disabled={loading}
                startIcon={
                  loading ? <CircularProgress size={20} /> : <AccountBalance />
                }
                sx={{ mt: 2 }}
              >
                Get Balance
              </Button>

              {accountBalance && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Account Details:
                  </Typography>
                  <Typography variant="body2">
                    Balance: {accountBalance.balance} {accountBalance.currency}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" color="text.secondary">
        This example demonstrates the Airtel Money API integration including:
        <ul>
          <li>Payment requests to customers</li>
          <li>Transaction status checking</li>
          <li>Transaction refunds</li>
          <li>Account balance retrieval</li>
        </ul>
      </Typography>
    </Box>
  );
};

export default AirtelMoneyExample;
