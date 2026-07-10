export type RentalPushLocale = 'en' | 'fr';

function normalizeLocale(lang?: string | null): RentalPushLocale {
  return (lang || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function buildRentalRequestAcceptedPush(params: {
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Offre de location prête' : 'Rental offer ready',
    body: fr
      ? `Votre demande pour ${params.rentalItemName} a été acceptée. Confirmez et payez avant expiration.`
      : `Your request for ${params.rentalItemName} was accepted. Confirm and pay before it expires.`,
  };
}

export function buildRentalRequestRejectedPush(params: {
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Demande de location refusée' : 'Rental request declined',
    body: fr
      ? `Votre demande pour ${params.rentalItemName} n'est pas disponible.`
      : `Your request for ${params.rentalItemName} is not available.`,
  };
}

export function buildRentalBookingConfirmedPush(params: {
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Location confirmée' : 'Rental confirmed',
    body: fr
      ? `${params.rentalItemName} (${params.bookingNumber}) est confirmée. Votre code PIN est prêt.`
      : `${params.rentalItemName} (${params.bookingNumber}) is confirmed. Your start PIN is ready.`,
  };
}

export function buildRentalPeriodEndedPush(params: {
  rentalItemName: string;
  forBusiness: boolean;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  if (params.forBusiness) {
    return {
      title: fr ? 'Retour de location' : 'Rental return due',
      body: fr
        ? `La période pour ${params.rentalItemName} est terminée. Confirmez le retour.`
        : `The rental period for ${params.rentalItemName} has ended. Confirm the return.`,
    };
  }
  return {
    title: fr ? 'Période de location terminée' : 'Rental period ended',
    body: fr
      ? `La période pour ${params.rentalItemName} est terminée. Retournez l'article au commerce.`
      : `The rental period for ${params.rentalItemName} has ended. Return the item to the business.`,
  };
}

export function buildRentalBookingRequestPush(params: {
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Nouvelle demande de location' : 'New rental request',
    body: fr
      ? `Une demande pour ${params.rentalItemName} attend votre réponse.`
      : `A request for ${params.rentalItemName} is waiting for your response.`,
  };
}
