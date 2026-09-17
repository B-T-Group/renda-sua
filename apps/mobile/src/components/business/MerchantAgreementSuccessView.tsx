import React from 'react';
import { useTranslation } from 'react-i18next';
import { SetupStepSuccessView } from './SetupStepSuccessView';

type Props = {
  onBackToDashboard: () => void;
  pdfDeferred?: boolean;
};

/** Shown after the merchant signs the partnership agreement. */
export function MerchantAgreementSuccessView({
  onBackToDashboard,
  pdfDeferred = false,
}: Props) {
  const { t } = useTranslation();
  return (
    <SetupStepSuccessView
      step="agreement"
      variant="continue"
      onBackToDashboard={onBackToDashboard}
      footnote={
        pdfDeferred
          ? t(
              'business.verification.agreementPdfDeferred',
              'Your signature is saved. A signed PDF copy will appear in your documents once it is ready.'
            )
          : undefined
      }
    />
  );
}
