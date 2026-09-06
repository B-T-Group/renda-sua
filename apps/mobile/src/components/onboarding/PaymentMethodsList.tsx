import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { OnboardingBulletRow } from './OnboardingBulletRow';
import { getSupportedCountries } from '../../services/supportedCountriesApi';
import {
  resolvePaymentMethodDisplays,
  type PaymentMethodDisplay,
} from '../../utils/paymentMethodDisplay';
import { useStore } from '../../stores/RootStore';

type Props = {
  /** Override country (defaults to market selection). */
  countryCode?: string;
};

function PaymentMethodsListBase({ countryCode }: Props) {
  const { t } = useTranslation();
  const { market } = useStore();
  const code = (countryCode ?? market.selectedCountryCode ?? 'CM').toUpperCase();
  const [methods, setMethods] = useState<PaymentMethodDisplay[]>(() =>
    resolvePaymentMethodDisplays(null)
  );

  useEffect(() => {
    let active = true;
    void getSupportedCountries()
      .then((countries) => {
        if (!active) return;
        const match = countries.find((c) => c.code.toUpperCase() === code);
        setMethods(resolvePaymentMethodDisplays(match?.supportedPaymentMethods));
      })
      .catch(() => {
        if (active) setMethods(resolvePaymentMethodDisplays(null));
      });
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <View>
      {methods.map((m) => (
        <OnboardingBulletRow
          key={m.systemName}
          icon={m.icon}
          text={t(m.labelKey, m.labelDefault)}
        />
      ))}
    </View>
  );
}

export const PaymentMethodsList = observer(PaymentMethodsListBase);
