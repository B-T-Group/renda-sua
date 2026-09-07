import React from 'react';
import { SetupStepSuccessView } from './SetupStepSuccessView';

type Props = {
  onBackToDashboard: () => void;
};

/** Shown after the merchant signs the partnership agreement. */
export function MerchantAgreementSuccessView({ onBackToDashboard }: Props) {
  return (
    <SetupStepSuccessView
      step="agreement"
      variant="continue"
      onBackToDashboard={onBackToDashboard}
    />
  );
}
