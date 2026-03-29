import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type { Breakpoint } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'error'
    | 'info'
    | 'warning';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  additionalContent?: React.ReactNode;
  /** Wider dialog when showing structured details (e.g. booking summary). */
  maxWidth?: false | Breakpoint;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  message,
  confirmText,
  cancelText,
  confirmColor = 'primary',
  loading = false,
  onConfirm,
  onCancel,
  additionalContent,
  maxWidth = 'sm',
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
      maxWidth={maxWidth}
      fullWidth
    >
      <DialogTitle id="confirmation-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {additionalContent ? (
          <Box sx={{ mb: message ? 2.5 : 0 }}>{additionalContent}</Box>
        ) : null}
        {message ? (
          <DialogContentText id="confirmation-dialog-description" component="div">
            {message}
          </DialogContentText>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onCancel} disabled={loading} color="inherit">
          {cancelText || t('common.no')}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          color={confirmColor}
          variant="contained"
          disabled={loading}
          autoFocus
          startIcon={
            loading ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {loading ? t('common.loading') : confirmText || t('common.yes')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;
