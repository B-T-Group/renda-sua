import { Info, Warning } from '@mui/icons-material';
import { Alert, AlertTitle, Card, CardContent } from '@mui/material';
import React from 'react';

export interface MessageCardProps {
  title?: string;
  message: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  action?: React.ReactNode;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  title,
  message,
  severity = 'info',
  action,
}) => (
  <Card variant="outlined" sx={{ mb: 2 }}>
    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
      <Alert
        severity={severity}
        icon={severity === 'warning' || severity === 'error' ? <Warning /> : <Info />}
        action={action}
      >
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        {message}
      </Alert>
    </CardContent>
  </Card>
);

export default MessageCard;
