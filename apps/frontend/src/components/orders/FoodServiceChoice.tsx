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
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
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
          onPress={() => onChange(key)}
        >
          {key === 'eat_in' ? (
            <EatInIllustration size={40} color={value === key ? 'primary.main' : 'text.secondary'} />
          ) : null}
          {key === 'take_out' ? (
            <TakeOutIllustration size={40} color={value === key ? 'primary.main' : 'text.secondary'} />
          ) : null}
          {key === 'delivery' ? (
            <DeliveryMark color={value === key ? 'primary.main' : 'text.secondary'} />
          ) : null}
        </ChoiceCard>
      ))}
    </Stack>
  );
}

function ChoiceCard({
  selected,
  disabled,
  label,
  onPress,
  children,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onPress}
      aria-label={label}
      aria-pressed={selected}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 0.5,
        py: 0.5,
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        color: selected ? 'primary.main' : 'text.secondary',
      }}
    >
      {children}
      {selected ? (
        <Typography
          variant="caption"
          fontWeight={700}
          textAlign="center"
          color="primary.main"
          sx={{ lineHeight: 1.2 }}
        >
          {label}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}

function DeliveryMark({ color }: { color: string }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: 40,
        height: 29,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}
    >
      <Box component="span" sx={{ fontSize: 28, lineHeight: 1 }}>
        <svg width="36" height="28" viewBox="0 0 48 36" fill="none">
          <path d="M4 22h28V10H4v12z" stroke="currentColor" strokeWidth="2.5" />
          <path d="M32 16h8l4 6v6h-12V16z" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="12" cy="28" r="3" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="36" cy="28" r="3" stroke="currentColor" strokeWidth="2.5" />
        </svg>
      </Box>
    </Box>
  );
}
