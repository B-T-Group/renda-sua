import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EatInIllustration } from './EatInIllustration';
import { TakeOutIllustration } from './TakeOutIllustration';

export type FoodServiceChoiceValue = 'delivery' | 'eat_in' | 'take_out';

interface FoodServiceChoiceProps {
  value: FoodServiceChoiceValue;
  onChange: (value: FoodServiceChoiceValue) => void;
  showDelivery?: boolean;
  disabled?: boolean;
}

export function FoodServiceChoice({
  value,
  onChange,
  showDelivery = true,
  disabled = false,
}: FoodServiceChoiceProps) {
  const { t } = useTranslation();
  const options: FoodServiceChoiceValue[] = showDelivery
    ? ['eat_in', 'take_out', 'delivery']
    : ['eat_in', 'take_out'];
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
      {options.map((key) => (
        <ChoiceCard
          key={key}
          selected={value === key}
          disabled={disabled}
          label={
            key === 'eat_in'
              ? t('orders.eatIn.eatIn', 'Eat in')
              : key === 'take_out'
                ? t('orders.eatIn.takeOut', 'Take out')
                : t('checkout.fulfillmentDelivery', 'Delivery')
          }
          hint={key === 'eat_in' ? t('orders.eatIn.hint', 'You are asking for a table. The kitchen may not have one.') : undefined}
          onPress={() => onChange(key)}
        >
          {key === 'eat_in' ? <EatInIllustration size={72} /> : null}
          {key === 'take_out' ? <TakeOutIllustration size={72} /> : null}
          {key === 'delivery' ? <DeliveryMark /> : null}
        </ChoiceCard>
      ))}
    </Stack>
  );
}

function ChoiceCard({
  selected,
  disabled,
  label,
  hint,
  onPress,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  hint?: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onPress}
      sx={{
        flex: 1,
        p: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.50' : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      {children}
      <Typography variant="subtitle2" fontWeight={700}>
        {label}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" textAlign="center">
          {hint}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}

function DeliveryMark() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 72,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'primary.main',
        fontSize: 28,
      }}
    >
      <Box component="span" sx={{ fontSize: 28, lineHeight: 1 }}>
        <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
          <path d="M4 22h28V10H4v12z" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 16h8l4 6v6h-12V16z" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="12" cy="28" r="3" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="36" cy="28" r="3" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </Box>
    </Box>
  );
}
