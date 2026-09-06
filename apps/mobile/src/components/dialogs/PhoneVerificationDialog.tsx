import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Button, Text, ActivityIndicator, HelperText } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useTwilioVerify } from '../../hooks/useTwilioVerify';
import { OtpInput } from '../OtpInput';

interface PhoneVerificationDialogProps {
  visible: boolean;
  phoneNumber: string;
  onDismiss: () => void;
  onVerified: () => void;
}

type VerificationStep = 'confirm' | 'code-entry' | 'success';

export function PhoneVerificationDialog({
  visible,
  phoneNumber,
  onDismiss,
  onVerified,
}: PhoneVerificationDialogProps) {
  const { t } = useTranslation();
  const { startVerification, verifyCode, loading, error, reset } = useTwilioVerify();
  const [step, setStep] = useState<VerificationStep>('confirm');
  const [code, setCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep('confirm');
      setCode('');
      setResendCountdown(0);
      reset();
    }
  }, [visible, reset]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleSendCode = async () => {
    try {
      await startVerification(phoneNumber, 'sms');
      setStep('code-entry');
      setResendCountdown(60);
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const handleVerifyCode = async () => {
    try {
      const result = await verifyCode(phoneNumber, code);
      if (result.valid) {
        setStep('success');
        setTimeout(() => {
          onVerified();
          onDismiss();
        }, 1500);
      }
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const handleResend = async () => {
    try {
      await startVerification(phoneNumber, 'sms');
      setCode('');
      setResendCountdown(60);
    } catch {
      // Error is handled by the hook and displayed via the error state
    }
  };

  const maskPhoneNumber = (phone: string): string => {
    if (phone.length < 4) return phone;
    return `***${phone.slice(-4)}`;
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <View style={styles.content}>
          <Text variant="headlineSmall" style={styles.title}>
            {t('profile.phoneVerifyDialogTitle', 'Verify your phone number')}
          </Text>

          {error && (
            <HelperText type="error" visible={!!error} style={styles.error}>
              {error}
            </HelperText>
          )}

          {step === 'confirm' && (
            <View style={styles.section}>
              <Text variant="bodyMedium" style={styles.message}>
                {t('profile.phoneVerifyConfirmMessage', 'We will send a verification code to:')}
              </Text>
              <Text variant="bodyLarge" style={styles.phoneNumber}>
                {phoneNumber}
              </Text>
            </View>
          )}

          {step === 'code-entry' && (
            <View style={styles.section}>
              <Text variant="bodyMedium" style={styles.message}>
                {t('profile.phoneVerifyCodeMessage', 'Enter the 6-digit code sent to')} {maskPhoneNumber(phoneNumber)}
              </Text>
              <View style={styles.otpContainer}>
                <OtpInput
                  value={code}
                  onChangeText={setCode}
                  length={6}
                  disabled={loading}
                />
              </View>
              <Button
                mode="text"
                onPress={handleResend}
                disabled={resendCountdown > 0 || loading}
                style={styles.resendButton}
              >
                {resendCountdown > 0
                  ? t('profile.phoneVerifyResendIn', 'Resend in {{seconds}}s', {
                      seconds: resendCountdown,
                    })
                  : t('profile.phoneVerifyResend', 'Resend code')}
              </Button>
            </View>
          )}

          {step === 'success' && (
            <View style={styles.section}>
              <Text variant="bodyMedium" style={styles.successMessage}>
                {t('profile.phoneVerifySuccess', 'Phone number verified successfully')}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              disabled={loading || step === 'success'}
              style={styles.button}
            >
              {step === 'success' ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
            </Button>
            {step === 'confirm' && (
              <Button
                mode="contained"
                onPress={handleSendCode}
                disabled={loading}
                loading={loading}
                style={styles.button}
              >
                {t('profile.phoneVerifySendCode', 'Send verification code')}
              </Button>
            )}
            {step === 'code-entry' && (
              <Button
                mode="contained"
                onPress={handleVerifyCode}
                disabled={code.length !== 6 || loading}
                loading={loading}
                style={styles.button}
              >
                {t('profile.phoneVerifySubmit', 'Verify')}
              </Button>
            )}
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  content: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 32,
  },
  title: {
    marginBottom: 16,
    fontWeight: '600',
  },
  section: {
    marginVertical: 16,
  },
  message: {
    marginBottom: 12,
    color: '#666',
  },
  phoneNumber: {
    fontWeight: '600',
    marginBottom: 16,
  },
  otpContainer: {
    marginVertical: 20,
  },
  resendButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  error: {
    marginBottom: 12,
    backgroundColor: '#ffebee',
  },
  successMessage: {
    color: '#4caf50',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
});
