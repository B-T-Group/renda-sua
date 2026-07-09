import { Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  SIGNUP_BENEFIT_BULLET_KEYS,
  type SignupBenefitPersona,
} from '../../constants/signupBenefits';

export interface PersonaBenefitBulletsProps {
  persona: SignupBenefitPersona;
  /** Compact list for goal cards; default false. */
  compact?: boolean;
  align?: 'left' | 'center';
}

const HEADLINE_DEFAULTS: Record<SignupBenefitPersona, string> = {
  client: 'Shop local, track every order',
  agent: 'Deliver on your schedule, get paid per trip',
  business: 'Open your storefront and start selling',
  businessRent: 'List rentals and start earning',
};

const BULLET_DEFAULTS: Record<SignupBenefitPersona, Record<string, string>> = {
  client: {
    b1: 'Browse and buy from nearby stores in one place',
    b2: 'Track delivery in real time and chat with your agent',
    b3: 'Save addresses and reorder faster next time',
  },
  agent: {
    b1: 'Claim nearby delivery runs when it suits you',
    b2: 'Navigate pickups and drop-offs with in-app guidance',
    b3: 'Get paid per completed delivery',
  },
  business: {
    b1: 'List products with photos and AI-assisted details',
    b2: 'Manage orders, inventory, and locations in one dashboard',
    b3: 'Reach local buyers; we handle delivery coordination',
  },
  businessRent: {
    b1: 'List rentals with photos and AI-assisted details',
    b2: 'Manage bookings, inventory, and locations in one dashboard',
    b3: 'Reach local renters; we handle coordination',
  },
};

export const PersonaBenefitBullets: React.FC<PersonaBenefitBulletsProps> = ({
  persona,
  compact = false,
  align = 'left',
}) => {
  const { t } = useTranslation();
  const textAlign = align === 'center' ? 'center' : 'left';

  return (
    <Box sx={{ textAlign }}>
      <Typography
        variant={compact ? 'caption' : 'body2'}
        fontWeight={700}
        color="text.primary"
        sx={{ display: 'block', mb: compact ? 0.5 : 0.75, lineHeight: 1.35 }}
      >
        {t(
          `signup.benefits.${persona}.headline`,
          HEADLINE_DEFAULTS[persona]
        )}
      </Typography>
      <Box
        component="ul"
        sx={{
          m: 0,
          pl: align === 'center' ? 0 : 2.25,
          listStyle: 'none',
          textAlign,
        }}
      >
        {SIGNUP_BENEFIT_BULLET_KEYS.map((key) => (
          <Typography
            key={key}
            component="li"
            variant="caption"
            color="text.secondary"
            sx={{
              lineHeight: 1.45,
              mb: 0.35,
              fontSize: compact ? '0.7rem' : '0.75rem',
              '&::before': align === 'center' ? undefined : {
                content: '"•"',
                position: 'absolute',
                ml: -1.25,
              },
              position: 'relative',
            }}
          >
            {t(
              `signup.benefits.${persona}.${key}`,
              BULLET_DEFAULTS[persona][key]
            )}
          </Typography>
        ))}
      </Box>
    </Box>
  );
};
