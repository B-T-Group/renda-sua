import { alpha, Box, ButtonBase, Stack, Typography, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DeliveryIllustration } from './DeliveryIllustration';
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
    <Stack
      direction="row"
      spacing={1}
      role="radiogroup"
      aria-label={t('checkout.fulfillmentTitle', 'How do you want to receive your order?')}
      sx={{ mb: 2 }}
    >
      {options.map((key) => (
        <ChoiceCard
          key={key}
          selected={value === key}
          disabled={disabled}
          label={choiceLabel(t, key)}
          onPress={() => onChange(key)}
        >
          <ChoiceArt kind={key} colored={value === key} />
        </ChoiceCard>
      ))}
    </Stack>
  );
}

function choiceLabel(
  t: (key: string, defaultValue: string) => string,
  key: FoodServiceChoiceValue
): string {
  if (key === 'eat_in') return t('orders.eatIn.eatIn', 'Eat in');
  if (key === 'take_out') return t('orders.eatIn.takeOut', 'Take out');
  return t('checkout.fulfillmentDelivery', 'Delivery');
}

function ChoiceArt({ kind, colored }: { kind: FoodServiceChoiceValue; colored: boolean }) {
  const art =
    kind === 'eat_in' ? (
      <EatInIllustration size={40} />
    ) : kind === 'take_out' ? (
      <TakeOutIllustration size={40} />
    ) : (
      <DeliveryIllustration size={40} />
    );
  return (
    <Box sx={{ filter: colored ? 'none' : 'grayscale(1)', opacity: colored ? 1 : 0.72, lineHeight: 0 }}>
      {art}
    </Box>
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
  const theme = useTheme();
  const border = selected
    ? theme.palette.primary.main
    : alpha(theme.palette.text.primary, 0.22);
  const fill = selected ? alpha(theme.palette.primary.main, 0.1) : theme.palette.background.paper;
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onPress}
      role="radio"
      aria-checked={selected}
      aria-label={label}
      sx={{
        flex: 1,
        minWidth: 0,
        px: 0.5,
        py: 1,
        borderRadius: 2,
        border: '1.5px solid',
        borderColor: border,
        bgcolor: fill,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        boxShadow: selected ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}` : 'none',
        '&:hover': {
          borderColor: theme.palette.primary.main,
          bgcolor: alpha(theme.palette.primary.main, selected ? 0.14 : 0.05),
        },
      }}
    >
      {children}
      {selected ? (
        <Typography variant="caption" fontWeight={700} textAlign="center" color="primary.main">
          {label}
        </Typography>
      ) : null}
    </ButtonBase>
  );
}
