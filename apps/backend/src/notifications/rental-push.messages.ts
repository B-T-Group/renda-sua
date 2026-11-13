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

export function buildRentalBookingReservedPush(params: {
  rentalItemName: string;
  bookingNumber: string;
  forBusiness: boolean;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  if (params.forBusiness) {
    return {
      title: fr ? 'Location réservée' : 'Rental reserved',
      body: fr
        ? `${params.rentalItemName} (${params.bookingNumber}) est réservé. Le client paiera au retrait.`
        : `${params.rentalItemName} (${params.bookingNumber}) is reserved. The client will pay at pickup.`,
    };
  }
  return {
    title: fr ? 'Location réservée' : 'Rental reserved',
    body: fr
      ? `${params.rentalItemName} (${params.bookingNumber}) est réservé. Payez au retrait pour commencer.`
      : `${params.rentalItemName} (${params.bookingNumber}) is reserved. Pay at pickup to start.`,
  };
}

export function buildRentalBookingCancelledPush(params: {
  rentalItemName: string;
  bookingNumber: string;
  cancelledBy: 'client' | 'business' | 'system';
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  if (params.cancelledBy === 'system') {
    return {
      title: fr ? 'Réservation expirée' : 'Reservation expired',
      body: fr
        ? `La réservation de ${params.rentalItemName} (${params.bookingNumber}) a expiré car le paiement n'a pas été effectué au retrait. Aucun frais.`
        : `The reservation for ${params.rentalItemName} (${params.bookingNumber}) expired because payment was not completed at pickup. No charge.`,
    };
  }
  const byClient = params.cancelledBy === 'client';
  return {
    title: fr ? 'Location annulée' : 'Rental cancelled',
    body: fr
      ? `${params.rentalItemName} (${params.bookingNumber}) a été annulée par ${byClient ? 'le client' : 'le commerce'}. Aucun frais.`
      : `${params.rentalItemName} (${params.bookingNumber}) was cancelled by the ${byClient ? 'client' : 'business'}. No charge.`,
  };
}

export function buildRentalEndingSoonPush(params: {
  rentalItemName: string;
  forBusiness: boolean;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  if (params.forBusiness) {
    return {
      title: fr ? 'Fin de location dans 30 min' : 'Rental ends in 30 min',
      body: fr
        ? `La location de ${params.rentalItemName} se termine dans 30 minutes. Préparez le retour.`
        : `The rental of ${params.rentalItemName} ends in 30 minutes. Prepare for the return.`,
    };
  }
  return {
    title: fr ? 'Fin de location dans 30 min' : 'Rental ends in 30 min',
    body: fr
      ? `Votre location de ${params.rentalItemName} se termine dans 30 minutes. Retournez l'article à temps pour éviter des frais supplémentaires.`
      : `Your rental of ${params.rentalItemName} ends in 30 minutes. Return the item on time to avoid extra charges.`,
  };
}

export function buildRentalRequestUpdatedPush(params: {
  rentalItemName: string;
  clientName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Demande mise à jour' : 'Request updated',
    body: fr
      ? `${params.clientName} a mis à jour la demande pour ${params.rentalItemName}. Vérifiez les modifications avant d'accepter.`
      : `${params.clientName} updated the request for ${params.rentalItemName}. Review the changes before accepting.`,
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

/** Exact business copy. Do not paraphrase. */
export const RENTAL_NOT_RECEIVED_BUSINESS_BODY = {
  en: "The renter says they haven't received the item. Support will follow up.",
  fr: "Le client indique ne pas avoir reçu l'article. Le support va vous contacter.",
} as const;

export function buildRentalNotReceivedNotice(params: {
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Article non reçu' : 'Item not received',
    body: fr ? RENTAL_NOT_RECEIVED_BUSINESS_BODY.fr : RENTAL_NOT_RECEIVED_BUSINESS_BODY.en,
  };
}

export function buildRenterReturnedNotice(params: {
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName || 'Rental';
  const booking = params.bookingNumber || '—';
  return {
    title: fr ? 'Le client indique avoir rendu l’article' : 'Renter says the item is back',
    body: fr
      ? `${item} · ${booking}. Vérifiez l’article et confirmez le retour.`
      : `${item} · ${booking}. Please check the item and confirm the return.`,
  };
}

export function buildRenterReturnEscalationNotice(params: {
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName || 'Rental';
  const booking = params.bookingNumber || '—';
  return {
    title: fr ? 'Retour signalé sans confirmation' : 'Return reported and not confirmed',
    body: fr
      ? `${item} · ${booking}. Le client a signalé le retour. L’entreprise n’a pas confirmé dans les 24 heures. La caution reste retenue.`
      : `${item} · ${booking}. The renter reported the return. The business has not confirmed within 24 hours. The deposit is still held.`,
  };
}

export function buildRentalNotReceivedSupportNotice(params: {
  bookingNumber: string;
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const booking = params.bookingNumber || '—';
  const item = params.rentalItemName || 'Rental';
  return {
    title: fr ? 'Article non remis au locataire' : 'Renter has not received the item',
    body: fr
      ? `${booking} · ${item}. Le locataire indique ne pas avoir reçu l'article. Aucun remboursement ni annulation.`
      : `${booking} · ${item}. The renter says they have not received the item. No refund or cancellation.`,
  };
}

export function buildRentalInspectionNotice(params: {
  kind:
    | 'review_pickup'
    | 'review_return'
    | 'correction'
    | 'pickup_accepted'
    | 'return_reminder'
    | 'escalated'
    | 'disputed'
    | 'decided';
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName;
  const copy: Record<typeof params.kind, { title: string; body: string }> = {
    review_pickup: {
      title: fr ? "Vérifiez l'état des lieux" : 'Review item condition',
      body: fr
        ? `L'état des lieux de départ pour ${item} est prêt.`
        : `The pickup condition report for ${item} is ready to review.`,
    },
    review_return: {
      title: fr ? 'Vérifiez le retour' : 'Review the return',
      body: fr
        ? `Comparez le retour de ${item} aux photos de départ.`
        : `Compare the return of ${item} with the pickup photos.`,
    },
    correction: {
      title: fr ? 'Correction demandée' : 'Correction requested',
      body: fr
        ? `Le client a demandé une correction pour ${item}.`
        : `The renter asked for a correction on ${item}.`,
    },
    pickup_accepted: {
      title: fr ? 'État des lieux accepté' : 'Condition report accepted',
      body: fr
        ? `Le client a accepté l'état des lieux de ${item}.`
        : `The renter accepted the condition report for ${item}.`,
    },
    return_reminder: {
      title: fr ? 'Retour en attente de votre avis' : 'Please review the return',
      body: fr
        ? `Merci de vérifier le retour de ${item}. Sans réponse, un humain examinera le dossier.`
        : `Please review the return of ${item}. If you do not respond, a person will review it.`,
    },
    escalated: {
      title: fr ? 'Examen du retour' : 'Return under review',
      body: fr
        ? `Le retour de ${item} est examiné par le support. Aucun dommage n'est accepté automatiquement.`
        : `Support is reviewing the return of ${item}. A damage claim is never accepted automatically.`,
    },
    disputed: {
      title: fr ? 'Désaccord signalé' : 'Disagreement reported',
      body: fr
        ? `Un désaccord a été signalé sur le retour de ${item}.`
        : `A disagreement was reported on the return of ${item}.`,
    },
    decided: {
      title: fr ? 'Décision sur le retour' : 'Return decision',
      body: fr
        ? `Le support a tranché le retour de ${item}.`
        : `Support decided the return of ${item}.`,
    },
  };
  return copy[params.kind];
}

export function buildRentalAvailablePush(params: {
  itemName: string;
  startAt: string;
  endAt: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const dates = `${params.startAt.slice(0, 10)} – ${params.endAt.slice(0, 10)}`;
  return {
    title: fr ? 'Une location est libre' : 'A rental is free',
    body: fr
      ? `${params.itemName} est libre pour vos dates (${dates}).`
      : `${params.itemName} is free for your dates (${dates}).`,
  };
}
