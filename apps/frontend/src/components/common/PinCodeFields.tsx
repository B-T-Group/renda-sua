import React, { useCallback, useMemo, useRef } from 'react';
import { Box, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface PinCodeFieldsProps {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

function clampDigits(value: string, length: number): string {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, length);
}

export const PinCodeFields: React.FC<PinCodeFieldsProps> = ({
  value,
  onChange,
  length = 4,
  disabled = false,
  autoFocus = false,
}) => {
  const { t } = useTranslation();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = useMemo(() => {
    const v = clampDigits(value || '', length);
    return Array.from({ length }, (_, i) => v[i] ?? '');
  }, [length, value]);

  const setDigit = useCallback(
    (index: number, nextRaw: string) => {
      const nextDigit = nextRaw.replace(/\D/g, '').slice(-1);
      const nextDigits = [...digits];
      nextDigits[index] = nextDigit;
      const nextValue = clampDigits(nextDigits.join(''), length);
      onChange(nextValue);
      if (nextDigit && index < length - 1) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
      }
    },
    [digits, length, onChange]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !digits[index] && index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        onChange(clampDigits(nextDigits.join(''), length));
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
      if (e.key === 'ArrowRight' && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, length, onChange]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const pasted = e.clipboardData.getData('text');
      const next = clampDigits(pasted, length);
      if (!next) return;
      e.preventDefault();
      onChange(next);
      const focusIndex = Math.min(next.length, length - 1);
      setTimeout(() => inputRefs.current[focusIndex]?.focus(), 0);
    },
    [length, onChange]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        justifyContent: 'center',
        mb: 2,
      }}
      onPaste={handlePaste}
    >
      {Array.from({ length }, (_, i) => (
        <TextField
          key={i}
          inputRef={(el) => {
            inputRefs.current[i] = el;
          }}
          value={digits[i]}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          inputProps={{
            maxLength: 1,
            inputMode: 'numeric',
            pattern: '[0-9]*',
            'aria-label': `${t('orders.completeDelivery.pinLabel', 'Digit')} ${i + 1}`,
          }}
          sx={{
            width: 56,
            '& .MuiInputBase-input': { textAlign: 'center', fontSize: '1.25rem' },
          }}
        />
      ))}
    </Box>
  );
};

