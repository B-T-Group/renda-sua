import { Close as CloseIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import PhoneInput from '../common/PhoneInput';
import { useUserProfileContext } from '../../contexts/UserProfileContext';

interface AgentOnboardingModalProps {
  open: boolean;
  onComplete: () => void;
  loading?: boolean;
}

type DemoStage =
  | 'viewOrders'
  | 'orderDetails'
  | 'confirmCaution'
  | 'enRoute'
  | 'delivered'
  | 'accountSummary'
  | 'withdrawDemo';

type DemoOrderStatus =
  | 'AVAILABLE'
  | 'CLAIMED'
  | 'PICKED_UP'
  | 'IN_DELIVERY'
  | 'DELIVERED';

interface DemoOrder {
  id: string;
  customerName: string;
  businessName: string;
  pickupAddress: string;
  deliveryAddress: string;
  commission: number;
  caution: number;
  status: DemoOrderStatus;
}

interface DemoTransaction {
  id: string;
  label: string;
  amount: number;
  type: 'credit' | 'debit';
}

interface DemoAccount {
  balance: number;
  pendingCaution: number;
  transactions: DemoTransaction[];
}

const initialOrder: DemoOrder = {
  id: 'RS-12345',
  customerName: 'John Doe',
  businessName: 'SuperMart – Bonamoussadi',
  pickupAddress: 'Bonamoussadi, Douala',
  deliveryAddress: 'Makepe, Douala',
  commission: 800,
  caution: 5000,
  status: 'AVAILABLE',
};

const initialAccount: DemoAccount = {
  balance: 0,
  pendingCaution: 0,
  transactions: [],
};

const demoStages: DemoStage[] = [
  'viewOrders',
  'orderDetails',
  'confirmCaution',
  'enRoute',
  'delivered',
  'accountSummary',
  'withdrawDemo',
];

const getStatusLabel = (status: DemoOrderStatus, t: TFunction) => {
  if (status === 'AVAILABLE') {
    return t(
      'agentOnboarding.interactive.status.available',
      'Ready for pickup',
    );
  }
  if (status === 'CLAIMED') {
    return t(
      'agentOnboarding.interactive.status.claimed',
      'Claimed',
    );
  }
  if (status === 'PICKED_UP') {
    return t(
      'agentOnboarding.interactive.status.pickedUp',
      'Picked up',
    );
  }
  if (status === 'IN_DELIVERY') {
    return t(
      'agentOnboarding.interactive.status.inDelivery',
      'In delivery',
    );
  }
  return t(
    'agentOnboarding.interactive.status.delivered',
    'Delivered',
  );
};

const getStageInstruction = (stage: DemoStage, t: TFunction) => {
  if (stage === 'viewOrders') {
    return t(
      'agentOnboarding.interactive.instructions.viewOrders',
      'Click the highlighted order to see more details.',
    );
  }
  if (stage === 'orderDetails') {
    return t(
      'agentOnboarding.interactive.instructions.orderDetails',
      'Review the order, then click “Claim order”.',
    );
  }
  if (stage === 'confirmCaution') {
    return t(
      'agentOnboarding.interactive.instructions.confirmCaution',
      'Confirm the caution deposit to reserve this order.',
    );
  }
  if (stage === 'enRoute') {
    return t(
      'agentOnboarding.interactive.instructions.enRoute',
      'Update the order status as you pick up and start delivery.',
    );
  }
  if (stage === 'delivered') {
    return t(
      'agentOnboarding.interactive.instructions.delivered',
      'The order is delivered. Click the Account tab to see your earnings.',
    );
  }
  if (stage === 'withdrawDemo') {
    return t(
      'agentOnboarding.interactive.instructions.withdrawDemo',
      'Enter your mobile money phone number (we use your profile number by default) and simulate a withdrawal.',
    );
  }
  return t(
    'agentOnboarding.interactive.instructions.accountSummary',
    'Review your updated balance and transactions, then start a withdrawal or finish the guide.',
  );
};

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => (
  <Box
    sx={{
      mx: 'auto',
      my: 2,
      width: 360,
      maxWidth: '100%',
      border: 1,
      borderColor: 'grey.300',
      boxShadow: 4,
      overflow: 'hidden',
      bgcolor: 'background.paper',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {children}
  </Box>
);

interface OrdersScreenProps {
  order: DemoOrder;
  stage: DemoStage;
  onOpenOrder: () => void;
  t: TFunction;
}

const OrdersScreen: React.FC<OrdersScreenProps> = ({
  order,
  stage,
  onOpenOrder,
  t,
}) => {
  const isHighlight = stage === 'viewOrders';
  const statusLabel = getStatusLabel(order.status, t);

  return (
    <Box sx={{ p: 2 }}>
      <Typography
        variant="subtitle2"
        color="text.secondary"
        sx={{ mb: 1 }}
      >
        {t(
          'agentOnboarding.interactive.ordersTitle',
          'Available orders',
        )}
      </Typography>
      <Paper
        elevation={isHighlight ? 6 : 1}
        onClick={stage === 'viewOrders' ? onOpenOrder : undefined}
        sx={{
          p: 2,
          borderRadius: 0,
          border: 2,
          borderColor: isHighlight ? 'primary.main' : 'grey.200',
          cursor: stage === 'viewOrders' ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {isHighlight && (
          <Chip
            color="primary"
            label={t(
              'agentOnboarding.interactive.tapHere',
              'Tap here',
            )}
            size="small"
            sx={{ position: 'absolute', top: 8, right: 8 }}
          />
        )}
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600 }}
        >
          {order.businessName}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          {order.customerName} • {order.id}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 1.5,
          }}
        >
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
            >
              {t(
                'agentOnboarding.interactive.pickup',
                'Pickup',
              )}
            </Typography>
            <Typography variant="body2">
              {order.pickupAddress}
            </Typography>
          </Box>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
            >
              {t(
                'agentOnboarding.interactive.dropoff',
                'Delivery',
              )}
            </Typography>
            <Typography variant="body2">
              {order.deliveryAddress}
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: 1.5,
          }}
        >
          <Typography
            variant="body2"
            color="primary"
          >
            {t(
              'agentOnboarding.interactive.commission',
              'You earn',
            )}{' '}
            {order.commission.toLocaleString()} XAF
          </Typography>
          <Chip
            label={statusLabel}
            size="small"
            color={order.status === 'AVAILABLE' ? 'default' : 'success'}
          />
        </Box>
      </Paper>
    </Box>
  );
};

interface OrderDetailsScreenProps {
  order: DemoOrder;
  stage: DemoStage;
  onClaim: () => void;
  t: TFunction;
}

const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  order,
  stage,
  onClaim,
  t,
}) => {
  const showHighlight = stage === 'orderDetails';

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600 }}
        >
          {order.businessName}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
        >
          {order.customerName} • {order.id}
        </Typography>
      </Box>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {t(
              'agentOnboarding.interactive.pickup',
              'Pickup',
            )}
          </Typography>
          <Typography variant="body2">
            {order.pickupAddress}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {t(
              'agentOnboarding.interactive.dropoff',
              'Delivery',
            )}
          </Typography>
          <Typography variant="body2">
            {order.deliveryAddress}
          </Typography>
        </Box>
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {t(
              'agentOnboarding.interactive.caution',
              'Caution deposit',
            )}
          </Typography>
          <Typography variant="body2">
            {order.caution.toLocaleString()} XAF
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={stage === 'orderDetails' ? onClaim : undefined}
          sx={{
            position: 'relative',
            borderWidth: showHighlight ? 2 : 0,
            borderStyle: showHighlight ? 'solid' : 'none',
            borderColor: showHighlight ? 'primary.light' : 'transparent',
          }}
        >
          {t(
            'agentOnboarding.interactive.claimOrder',
            'Claim order',
          )}
          {showHighlight && (
            <Chip
              color="secondary"
              label={t(
                'agentOnboarding.interactive.tapHere',
                'Tap here',
              )}
              size="small"
              sx={{ position: 'absolute', top: -18, right: 8 }}
            />
          )}
        </Button>
      </Box>
    </Box>
  );
};

interface CautionScreenProps {
  order: DemoOrder;
  stage: DemoStage;
  onConfirm: () => void;
  t: TFunction;
}

const CautionScreen: React.FC<CautionScreenProps> = ({
  order,
  stage,
  onConfirm,
  t,
}) => {
  const showHighlight = stage === 'confirmCaution';

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 600 }}
      >
        {t(
          'agentOnboarding.interactive.cautionTitle',
          'Confirm your caution deposit',
        )}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {t(
          'agentOnboarding.interactive.cautionText',
          'To secure this order, a refundable caution of {{amount}} XAF will be held until delivery is completed.',
          { amount: order.caution.toLocaleString() },
        )}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 0,
          bgcolor: 'grey.50',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Typography variant="body2">
            {t(
              'agentOnboarding.interactive.caution',
              'Caution deposit',
            )}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
          >
            {order.caution.toLocaleString()} XAF
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="body2">
            {t(
              'agentOnboarding.interactive.commission',
              'You earn',
            )}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600 }}
          >
            {order.commission.toLocaleString()} XAF
          </Typography>
        </Box>
      </Paper>
      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={stage === 'confirmCaution' ? onConfirm : undefined}
          sx={{
            position: 'relative',
            borderWidth: showHighlight ? 2 : 0,
            borderStyle: showHighlight ? 'solid' : 'none',
            borderColor: showHighlight ? 'primary.light' : 'transparent',
          }}
        >
          {t(
            'agentOnboarding.interactive.confirmCaution',
            'Confirm caution',
          )}
          {showHighlight && (
            <Chip
              color="secondary"
              label={t(
                'agentOnboarding.interactive.tapHere',
                'Tap here',
              )}
              size="small"
              sx={{ position: 'absolute', top: -18, right: 8 }}
            />
          )}
        </Button>
      </Box>
    </Box>
  );
};

interface EnRouteScreenProps {
  order: DemoOrder;
  stage: DemoStage;
  onAdvanceStatus: () => void;
  t: TFunction;
}

const EnRouteScreen: React.FC<EnRouteScreenProps> = ({
  order,
  stage,
  onAdvanceStatus,
  t,
}) => {
  const buttonLabel = useMemo(() => {
    if (order.status === 'CLAIMED') {
      return t(
        'agentOnboarding.interactive.markPickedUp',
        'Mark as picked up',
      );
    }
    if (order.status === 'PICKED_UP') {
      return t(
        'agentOnboarding.interactive.startDelivery',
        'Start delivery',
      );
    }
    if (order.status === 'IN_DELIVERY') {
      return t(
        'agentOnboarding.interactive.markDelivered',
        'Mark as delivered',
      );
    }
    return t(
      'agentOnboarding.interactive.markDelivered',
      'Mark as delivered',
    );
  }, [order.status, t]);

  const isHighlight = stage === 'enRoute';

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 600 }}
      >
        {t(
          'agentOnboarding.interactive.enRouteTitle',
          'Update the order status',
        )}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {t(
          'agentOnboarding.interactive.enRouteText',
          'As you pick up and start delivery, keep the order status updated so the customer can track progress.',
        )}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 0,
          bgcolor: 'grey.50',
        }}
      >
        <Typography
          variant="body2"
          sx={{ mb: 1 }}
        >
          {t(
            'agentOnboarding.interactive.currentStatus',
            'Current status',
          )}
        </Typography>
        <Chip
          label={getStatusLabel(order.status, t)}
          color="success"
          size="small"
        />
      </Paper>
      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={stage === 'enRoute' ? onAdvanceStatus : undefined}
          sx={{
            position: 'relative',
            borderWidth: isHighlight ? 2 : 0,
            borderStyle: isHighlight ? 'solid' : 'none',
            borderColor: isHighlight ? 'primary.light' : 'transparent',
          }}
        >
          {buttonLabel}
          {isHighlight && (
            <Chip
              color="secondary"
              label={t(
                'agentOnboarding.interactive.tapHere',
                'Tap here',
              )}
              size="small"
              sx={{ position: 'absolute', top: -18, right: 8 }}
            />
          )}
        </Button>
      </Box>
    </Box>
  );
};

interface AccountScreenProps {
  account: DemoAccount;
  onFinish: () => void;
  onWithdraw: () => void;
  t: TFunction;
}

const AccountScreen: React.FC<AccountScreenProps> = ({
  account,
  onFinish,
  onWithdraw,
  t,
}) => {
  const balanceLabel = `${account.balance.toLocaleString()} XAF`;

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 2,
          borderRadius: 0,
          border: 2,
          borderColor: 'primary.main',
          position: 'relative',
        }}
      >
        <Chip
          color="primary"
          label={t(
            'agentOnboarding.interactive.updated',
            'Updated',
          )}
          size="small"
          sx={{ position: 'absolute', top: 8, right: 8 }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {t(
            'agentOnboarding.interactive.currentBalance',
            'Current balance',
          )}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {balanceLabel}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5 }}
        >
          {t(
            'agentOnboarding.interactive.balanceHint',
            'Includes your refunded caution and delivery commission.',
          )}
        </Typography>
      </Paper>
      <Typography variant="subtitle2">
        {t(
          'agentOnboarding.interactive.recentTransactions',
          'Recent transactions',
        )}
      </Typography>
      <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
        {account.transactions.map((tx) => (
          <Box
            key={tx.id}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              py: 1,
              borderBottom: 1,
              borderColor: 'grey.100',
            }}
          >
            <Typography variant="body2">
              {tx.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color:
                  tx.type === 'credit' ? 'success.main' : 'error.main',
                fontWeight: 600,
              }}
            >
              {tx.type === 'credit' ? '+' : '-'}
              {tx.amount.toLocaleString()} XAF
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={onWithdraw}
          sx={{ mb: 1 }}
        >
          {t('accounts.withdraw', 'Withdraw')}
        </Button>
        <Button fullWidth onClick={onFinish}>
          {t('agentOnboarding.complete', 'Get Started')}
        </Button>
      </Box>
    </Box>
  );
};

interface WithdrawDemoScreenProps {
  balance: number;
  defaultPhoneNumber: string;
  t: TFunction;
  onComplete: () => void;
}

const WithdrawDemoScreen: React.FC<WithdrawDemoScreenProps> = ({
  balance,
  defaultPhoneNumber,
  t,
  onComplete,
}) => {
  const [phone, setPhone] = useState(defaultPhoneNumber);
  const [amount, setAmount] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleConfirmWithdraw = () => {
    setIsSubmitted(true);
  };

  return (
    <Box
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 600 }}
      >
        {t(
          'agentOnboarding.interactive.withdrawTitle',
          'Withdraw to Mobile Money',
        )}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
      >
        {t(
          'agentOnboarding.interactive.withdrawDescription',
          'Enter the mobile money phone number where you want to receive your funds. We pre-fill your profile phone number, but you can change it before withdrawing.',
        )}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 0,
          borderColor: 'grey.200',
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {t('accounts.availableBalance', 'Available balance')}
        </Typography>
        <Typography
          variant="h6"
          color="success.main"
          sx={{ fontWeight: 700 }}
        >
          {balance.toLocaleString()} XAF
        </Typography>
      </Paper>
      {!isSubmitted ? (
        <>
          <PhoneInput
            value={phone}
            onChange={(value) => setPhone(value || '')}
            label={t('accounts.phoneNumber', 'Phone Number')}
            placeholder={t(
              'accounts.phoneNumberPlaceholder',
              'Enter phone number',
            )}
            helperText={t(
              'accounts.phoneNumberHint',
              'Example: 062040404',
            )}
            defaultCountry="CM"
          />
          <TextField
            fullWidth
            label={t('accounts.amount', 'Amount')}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            placeholder={t('accounts.amountPlaceholder', 'Enter amount')}
          />
          <Box sx={{ mt: 'auto', pt: 1 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleConfirmWithdraw}
              disabled={!phone.trim() || !amount.trim()}
            >
              {t('accounts.withdraw', 'Withdraw')}
            </Button>
          </Box>
        </>
      ) : (
        <Box sx={{ mt: 'auto', pt: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            {t(
              'agentOnboarding.interactive.withdrawCompleteMessage',
              'Your withdrawal request has been sent in this demo. In the real app you will see a confirmation and the transaction in your history.',
            )}
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="primary"
            onClick={onComplete}
          >
            {t(
              'agentOnboarding.interactive.completeDemo',
              'Complete demo',
            )}
          </Button>
        </Box>
      )}
    </Box>
  );
};

interface InteractiveOnboardingContentProps {
  loading: boolean;
  onComplete: () => void;
}

const InteractiveOnboardingContent: React.FC<
  InteractiveOnboardingContentProps
> = ({ loading, onComplete }) => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const [stageIndex, setStageIndex] = useState(0);
  const [order, setOrder] = useState<DemoOrder>(initialOrder);
  const [account, setAccount] = useState<DemoAccount>(initialAccount);
  const [activeTab, setActiveTab] = useState<'orders' | 'account'>('orders');

  const stage = demoStages[stageIndex];
  const isAccountTabRequired =
    stage === 'accountSummary' || stage === 'delivered' || stage === 'withdrawDemo';

  const handleQuit = () => {
    if (!loading) {
      onComplete();
    }
  };

  const goToNextStage = () => {
    setStageIndex((prev) => Math.min(prev + 1, demoStages.length - 1));
  };

  const handleOpenOrder = () => {
    if (stage !== 'viewOrders') {
      return;
    }
    setActiveTab('orders');
    goToNextStage();
  };

  const handleClaimOrder = () => {
    if (stage !== 'orderDetails') {
      return;
    }
    goToNextStage();
  };

  const handleConfirmCaution = () => {
    if (stage !== 'confirmCaution') {
      return;
    }

    setOrder((prev) => ({
      ...prev,
      status: 'CLAIMED',
    }));
    setAccount({
      balance: 0,
      pendingCaution: initialOrder.caution,
      transactions: [
        {
          id: 'tx-1',
          label: t(
            'agentOnboarding.interactive.txCautionHold',
            'Caution hold for order RS-12345',
          ),
          amount: initialOrder.caution,
          type: 'debit',
        },
      ],
    });
    goToNextStage();
  };

  const handleAdvanceStatus = () => {
    if (stage !== 'enRoute') {
      return;
    }

    setOrder((prev) => {
      if (prev.status === 'CLAIMED') {
        return { ...prev, status: 'PICKED_UP' };
      }
      if (prev.status === 'PICKED_UP') {
        return { ...prev, status: 'IN_DELIVERY' };
      }
      if (prev.status === 'IN_DELIVERY') {
        const newAccount: DemoAccount = {
          balance: initialOrder.caution + initialOrder.commission,
          pendingCaution: 0,
          transactions: [
            {
              id: 'tx-1',
              label: t(
                'agentOnboarding.interactive.txCautionRefund',
                'Caution refund for order RS-12345',
              ),
              amount: initialOrder.caution,
              type: 'credit',
            },
            {
              id: 'tx-2',
              label: t(
                'agentOnboarding.interactive.txCommission',
                'Delivery commission for order RS-12345',
              ),
              amount: initialOrder.commission,
              type: 'credit',
            },
          ],
        };
        setAccount(newAccount);
        setStageIndex(demoStages.indexOf('delivered'));
        return { ...prev, status: 'DELIVERED' };
      }
      return prev;
    });
  };

  const handleStartWithdrawDemo = () => {
    if (stage !== 'accountSummary') {
      return;
    }
    setActiveTab('account');
    setStageIndex(demoStages.indexOf('withdrawDemo'));
  };

  const handleTabChange = (
    _: React.SyntheticEvent,
    value: 'orders' | 'account',
  ) => {
    setActiveTab(value);
    if (stage === 'delivered' && value === 'account') {
      setStageIndex(demoStages.indexOf('accountSummary'));
    }
  };

  const instruction = getStageInstruction(stage, t);
  const currentStepNumber = stageIndex + 1;
  const totalSteps = demoStages.length;

  const showOrders =
    activeTab === 'orders' || (!isAccountTabRequired && activeTab === 'account');

  const profilePhoneNumber = profile?.phone_number || '';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="h2">
          {t('agentOnboarding.title', 'How Deliveries Work')}
        </Typography>
        <IconButton
          onClick={handleQuit}
          disabled={loading}
          size="small"
          aria-label={t('agentOnboarding.quit', 'Skip Guide')}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ px: 2, py: 1, bgcolor: 'grey.50' }}>
        <Typography
          variant="body2"
          color="text.secondary"
          textAlign="center"
        >
          {t(
            'agentOnboarding.stepOf',
            'Step {{current}} of {{total}}',
            {
              current: currentStepNumber,
              total: totalSteps,
            },
          )}
        </Typography>
        <Typography
          variant="body2"
          color="text.primary"
          textAlign="center"
          sx={{ mt: 0.5 }}
        >
          {instruction}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        <PhoneFrame>
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600 }}
            >
              {t(
                'agentOnboarding.interactive.appTitle',
                'Rendasua Agent',
              )}
            </Typography>
          </Box>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tab
              value="orders"
              label={t(
                'agentOnboarding.interactive.ordersTab',
                'Orders',
              )}
            />
            <Tab
              value="account"
              label={t(
                'agentOnboarding.interactive.accountTab',
                'Account',
              )}
            />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {showOrders && stage === 'viewOrders' && (
              <OrdersScreen
                order={order}
                stage={stage}
                onOpenOrder={handleOpenOrder}
                t={t}
              />
            )}
            {showOrders && stage === 'orderDetails' && (
              <OrderDetailsScreen
                order={order}
                stage={stage}
                onClaim={handleClaimOrder}
                t={t}
              />
            )}
            {showOrders && stage === 'confirmCaution' && (
              <CautionScreen
                order={order}
                stage={stage}
                onConfirm={handleConfirmCaution}
                t={t}
              />
            )}
            {showOrders && (stage === 'enRoute' || stage === 'delivered') && (
              <EnRouteScreen
                order={order}
                stage={stage}
                onAdvanceStatus={handleAdvanceStatus}
                t={t}
              />
            )}
            {!showOrders && stage === 'accountSummary' && (
              <AccountScreen
                account={account}
                onFinish={onComplete}
                onWithdraw={handleStartWithdrawDemo}
                t={t}
              />
            )}
            {!showOrders && stage === 'withdrawDemo' && (
              <WithdrawDemoScreen
                balance={account.balance}
                defaultPhoneNumber={profilePhoneNumber}
                t={t}
                onComplete={onComplete}
              />
            )}
          </Box>
        </PhoneFrame>
      </Box>
    </Box>
  );
};

const AgentOnboardingModal: React.FC<AgentOnboardingModalProps> = ({
  open,
  onComplete,
  loading = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!open) {
    return null;
  }

  if (isMobile) {
    return (
      <Dialog open={open} fullScreen>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            p: 0,
            overflow: 'hidden',
          }}
        >
          <InteractiveOnboardingContent
            loading={loading}
            onComplete={onComplete}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: theme.zIndex.modal,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          py: 4,
          overflow: 'hidden',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 0,
          }}
        >
          <InteractiveOnboardingContent
            loading={loading}
            onComplete={onComplete}
          />
        </Paper>
      </Container>
    </Box>
  );
};

export default AgentOnboardingModal;
