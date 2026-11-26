import { formatRentalAmount } from '../assistant/assistant-rental-format';
import { marketTimeZone } from '../common/market-timezones';

export type RentalPushLocale = 'en' | 'fr';

function normalizeLocale(lang?: string | null): RentalPushLocale {
  return (lang || '').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function part(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((row) => row.type === type)?.value ?? '';
}

const NOTICE_ZONE: Record<string, { en: string; fr: string }> = {
  'America/Toronto': { en: 'Montréal time', fr: 'heure de Montréal' },
  'America/New_York': { en: 'New York time', fr: 'heure de New York' },
  'Africa/Douala': { en: 'Douala time', fr: 'heure de Douala' },
  'Africa/Libreville': { en: 'Libreville time', fr: 'heure de Libreville' },
  'Africa/Lome': { en: 'Lome time', fr: 'heure de Lomé' },
  'Africa/Porto-Novo': { en: 'Porto-Novo time', fr: 'heure de Porto-Novo' },
  'Africa/Abidjan': { en: 'Abidjan time', fr: "heure d'Abidjan" },
  'Africa/Brazzaville': { en: 'Brazzaville time', fr: 'heure de Brazzaville' },
  'Africa/Kinshasa': { en: 'Kinshasa time', fr: 'heure de Kinshasa' },
  'Africa/Ndjamena': { en: "N'Djamena time", fr: "heure de N'Djamena" },
  'Africa/Bangui': { en: 'Bangui time', fr: 'heure de Bangui' },
  'Africa/Malabo': { en: 'Malabo time', fr: 'heure de Malabo' },
  'Asia/Manila': { en: 'Manila time', fr: 'heure de Manille' },
};

function noticeClock(iso: string, language?: string | null): string {
  const fr = normalizeLocale(language) === 'fr';
  const parts = new Intl.DateTimeFormat(fr ? 'fr-CA' : 'en-CA', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const month = part(parts, 'month').replace(/\.$/, '');
  const label = fr ? `${month.toLowerCase()}.` : month;
  return `${part(parts, 'day')} ${label} · ${part(parts, 'hour')}:${part(parts, 'minute')}`;
}

function noticeZonePhrase(timeZone: string | null | undefined, language?: string | null): string {
  const row = NOTICE_ZONE[timeZone || ''];
  if (!row) return '';
  return normalizeLocale(language) === 'fr' ? row.fr : row.en;
}

/** Stored rental clock (UTC components) plus the listing city, when we know it. */
export function formatRentalNoticeDue(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
  language?: string | null
): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const clock = noticeClock(iso, language);
  const zone = noticeZonePhrase(timeZone, language);
  return zone ? `${clock} (${zone})` : clock;
}

/**
 * Clock time on the listing clock: "3:40 PM" in English for Americas listings,
 * "15:40" everywhere else (and always in French). `wall` = the ISO is stored
 * listing wall clock (end_at); otherwise it is a real instant.
 */
export function formatRentalNoticeClock(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
  language?: string | null,
  wall = false
): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: wall ? 'UTC' : timeZone || 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const hour = Number(part(parts, 'hour')) % 24;
  const minute = part(parts, 'minute');
  const twelve = normalizeLocale(language) === 'en' && (timeZone || '').startsWith('America/');
  if (!twelve) return `${String(hour).padStart(2, '0')}:${minute}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute}\u00a0${hour < 12 ? 'AM' : 'PM'}`;
}

export function rentalNoticeZone(countryCode?: string | null): string | null {
  return marketTimeZone(countryCode);
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

export function buildRentalRequestNoResponsePush(params: {
  businessName: string;
  window: 'sla' | 'start';
  preferredLanguage?: string | null;
}): { title: string; body: string; viewListing: string; browseRentals: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const body = fr ? noResponseBodyFr(params) : noResponseBodyEn(params);
  return {
    title: fr ? 'Demande de location refusée' : 'Rental request declined',
    body,
    viewListing: fr ? 'Voir l’annonce' : 'View listing',
    browseRentals: fr ? 'Parcourir les locations' : 'Browse rentals',
  };
}

function noResponseBodyEn(params: { businessName: string; window: 'sla' | 'start' }): string {
  const why = params.window === 'start'
    ? `${params.businessName} didn’t respond before the start time.`
    : `${params.businessName} didn’t respond within 24 hours.`;
  return `${why} You can send a new request from the listing, or browse other rentals.`;
}

function noResponseBodyFr(params: { businessName: string; window: 'sla' | 'start' }): string {
  const why = params.window === 'start'
    ? `${params.businessName} n’a pas répondu avant le début.`
    : `${params.businessName} n’a pas répondu sous 24 h.`;
  return `${why} Vous pouvez envoyer une nouvelle demande depuis l’annonce, ou parcourir d’autres locations.`;
}

export function buildBusinessRentalRequestExpiredPush(params: {
  window: 'sla' | 'start';
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const body = params.window === 'start'
    ? (fr ? 'Demande expirée — aucune réponse avant le début' : 'Request expired — no response before the start time')
    : (fr ? 'Demande expirée — aucune réponse en 24 h' : 'Request expired — no response in 24h');
  return { title: body, body };
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
  /** Inspected bookings mention the condition report. Every booking starts in the app. */
  inspected?: boolean;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = `${params.rentalItemName} (${params.bookingNumber})`;
  if (params.inspected) {
    return {
      title: fr ? 'Location confirmée' : 'Rental confirmed',
      body: fr
        ? `${item} est confirmée. Au retrait, l'entreprise partagera un état des lieux à accepter.`
        : `${item} is confirmed. At pickup, the business will share a condition report for you to accept.`,
    };
  }
  return {
    title: fr ? 'Location confirmée' : 'Rental confirmed',
    body: fr
      ? `${item} est confirmée. Le jour du retrait, appuyez sur Démarrer la location chez le commerce.`
      : `${item} is confirmed. On the pickup day, tap Start rental at the business.`,
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
  /** Client copy only. Business reserved copy does not change. */
  inspected?: boolean;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = `${params.rentalItemName} (${params.bookingNumber})`;
  if (params.forBusiness) {
    return {
      title: fr ? 'Location réservée' : 'Rental reserved',
      body: fr
        ? `${item} est réservé. Le client paiera au retrait.`
        : `${item} is reserved. The client will pay at pickup.`,
    };
  }
  if (params.inspected) {
    return {
      title: fr ? 'Location réservée' : 'Rental reserved',
      body: fr
        ? `${item} est réservée. Payez lorsque vous acceptez l'état des lieux au retrait.`
        : `${item} is reserved. Pay when you accept the condition report at pickup.`,
    };
  }
  return {
    title: fr ? 'Location réservée' : 'Rental reserved',
    body: fr
      ? `${item} est réservé. Payez au retrait pour commencer.`
      : `${item} is reserved. Pay at pickup to start.`,
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

export interface RenterReturnedEarly {
  renterName: string;
  /** Real instant of the renter's report. */
  returnedAt: string;
  /** Booked end, listing wall clock. */
  endAt: string;
  timeZone: string;
}

export function buildRenterReturnedNotice(params: {
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
  early?: RenterReturnedEarly;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName || 'Rental';
  if (params.early) return earlyReturnNotice(item, params.early, params.preferredLanguage);
  const booking = params.bookingNumber || '—';
  return {
    title: fr ? 'Le client indique avoir rendu l’article' : 'Renter says the item is back',
    body: fr
      ? `${item} · ${booking}. Vérifiez l’article et confirmez le retour.`
      : `${item} · ${booking}. Please check the item and confirm the return.`,
  };
}

/** Early return · {item}: the renter returned it before the booked end. */
function earlyReturnNotice(
  item: string,
  early: RenterReturnedEarly,
  language?: string | null
): { title: string; body: string } {
  const fr = normalizeLocale(language) === 'fr';
  const time = formatRentalNoticeClock(early.returnedAt, early.timeZone, language);
  const end = formatRentalNoticeClock(early.endAt, early.timeZone, language, true);
  const renter = early.renterName || (fr ? 'Le client' : 'The renter');
  return {
    title: fr ? `Retour anticipé · ${item}` : `Early return · ${item}`,
    body: fr
      ? `${renter} indique l’avoir rendu à ${time}, avant ${end}. Vérifiez-le et confirmez le retour.`
      : `${renter} says they returned it at ${time}, before ${end}. Check it and confirm the return.`,
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

function rentalStartedBody(fr: boolean, renter: string, item: string): string {
  return fr
    ? `${renter} a démarré la location de ${item}. Vous pouvez remettre l'article.`
    : `${renter} started ${item}. You can hand over the item.`;
}

export function buildRentalInspectionNotice(params: {
  kind:
    | 'review_pickup'
    | 'review_return'
    | 'photos_ready'
    | 'photos_requested'
    | 'correction'
    | 'pickup_accepted'
    | 'return_reminder'
    | 'escalated'
    | 'disputed'
    | 'decided';
  rentalItemName: string;
  preferredLanguage?: string | null;
  renterName?: string | null;
  returnDue?: string | null;
  /** MoMo accept: the rental is not active until payment lands. */
  paymentPending?: boolean;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName;
  const renter = params.renterName?.trim() || (fr ? 'Le locataire' : 'The renter');
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
    photos_ready: {
      title: fr ? 'Nouvelles photos prêtes' : 'New photos are ready',
      body: fr
        ? `De nouvelles photos de ${item} sont prêtes à vérifier.`
        : `New photos of ${item} are ready to check.`,
    },
    photos_requested: {
      title: fr ? 'Nouvelles photos demandées' : 'New photos requested',
      body: fr
        ? `${renter} demande de nouvelles photos avant de démarrer ${item}.`
        : `${renter} asked for new photos before starting ${item}.`,
    },
    correction: {
      title: fr ? 'Correction demandée' : 'Correction requested',
      body: fr
        ? `Le locataire a demandé une correction pour ${item}.`
        : `The renter asked for a correction on ${item}.`,
    },
    pickup_accepted: {
      title: fr ? 'État des lieux accepté' : 'Condition report accepted',
      body: fr
        ? `Le locataire a accepté l'état des lieux de ${item}.`
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
  const row = copy[params.kind];
  if (params.kind !== 'pickup_accepted' || !params.paymentPending) return row;
  const extra = fr ? ' Paiement en attente.' : ' Payment is pending.';
  return { ...row, body: `${row.body}${extra}` };
}

export function buildRentalStartedBusinessNotice(params: {
  rentalItemName: string;
  renterName?: string | null;
  returnDue?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName;
  const renter = params.renterName?.trim() || (fr ? 'Le locataire' : 'The renter');
  return {
    title: fr ? 'Location démarrée' : 'Rental started',
    body: rentalStartedBody(fr, renter, item),
  };
}

export function buildRentalNoShowNotice(params: {
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName || 'Rental';
  const booking = params.bookingNumber || '—';
  return {
    title: fr ? 'Location annulée' : 'Rental cancelled',
    body: fr
      ? `La location de ${item} (${booking}) a été annulée car elle n'a pas démarré. Aucun frais.`
      : `The rental of ${item} (${booking}) was cancelled because it was not started. No charge.`,
  };
}

export function buildRentalStartDayReminder(params: {
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const item = params.rentalItemName || 'Rental';
  return {
    title: fr ? "Retrait aujourd'hui" : 'Pickup today',
    body: fr
      ? `Le retrait de ${item} est aujourd'hui. Chez le commerce, appuyez sur Démarrer la location.`
      : `Pickup is today for ${item}. At the business, tap Start rental.`,
  };
}

export function buildItemNotCollectedSupport(params: {
  bookingNumber: string;
  rentalItemName: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const booking = params.bookingNumber || '—';
  const item = params.rentalItemName || 'Rental';
  return {
    title: fr ? 'Article non récupéré' : 'Item not collected',
    body: fr
      ? `${booking} · ${item}. Le commerce indique que l'article n'a pas été récupéré.`
      : `${booking} · ${item}. The business says the item was not collected.`,
  };
}

export function buildRentalStartedClientPush(params: {
  rentalItemName: string;
  returnDue?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const due = params.returnDue?.trim();
  const when = due
    ? fr
      ? `Le retour est dû le ${due}.`
      : `Return is due by ${due}.`
    : fr
      ? 'Le retour est dû à la fin prévue.'
      : 'Return is due by the booked end.';
  return {
    title: fr ? 'Location démarrée' : 'Rental started',
    body: fr
      ? `Votre location de ${params.rentalItemName} a commencé. ${when}`
      : `Your rental of ${params.rentalItemName} has started. ${when}`,
  };
}

export function buildReturnAcceptedPush(params: {
  rentalItemName: string;
  renterName?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const renter = params.renterName?.trim() || (fr ? 'Le locataire' : 'The renter');
  return {
    title: fr ? 'Retour accepté' : 'Return accepted',
    body: fr
      ? `${renter} a accepté le rapport de retour pour ${params.rentalItemName}.`
      : `${renter} accepted the return report for ${params.rentalItemName}.`,
  };
}

export function buildReportSentInApp(params: {
  rentalItemName: string;
  renterName?: string | null;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const renter = params.renterName?.trim() || (fr ? 'le client' : 'the renter');
  return {
    title: fr ? 'État des lieux envoyé' : 'Condition report sent',
    body: fr
      ? `Nous avons demandé à ${renter} de vérifier l'état des lieux de ${params.rentalItemName}.`
      : `We asked ${renter} to review the pickup report for ${params.rentalItemName}.`,
  };
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

export function buildConditionDeclinedNotice(params: {
  renterName: string;
  rentalItemName: string;
  bookingNumber: string;
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  return {
    title: fr ? 'Le locataire a refusé l’état des lieux' : 'Renter declined the condition',
    body: fr
      ? `${params.renterName} a refusé l’état des lieux de ${params.rentalItemName} (${params.bookingNumber}). La réservation est annulée et l’article est libre. Aucun frais.`
      : `${params.renterName} declined the condition of ${params.rentalItemName} (${params.bookingNumber}). The booking is cancelled and the unit is free. No charge.`,
  };
}

export function buildConditionRefundSupportNotice(params: {
  rentalItemName: string;
  bookingNumber: string;
  outcome: string;
  externalId?: string;
  walletCredited?: boolean;
}): { title: string; body: string } {
  const external = params.externalId ? ` External id ${params.externalId}.` : '';
  const wallet = params.walletCredited
    ? ' The wallet was credited. Do not pay the phone.'
    : ' The wallet was not credited.';
  return {
    title: 'Mobile Money refund needs review',
    body: `A Mobile Money refund for ${params.rentalItemName} (${params.bookingNumber}) is ${params.outcome}.${external}${wallet} Review it in rental declines.`,
  };
}

/** One renter notice when a decline refund is in the wallet or confirmed sent. */
export function buildConditionRefundRenterNotice(params: {
  amount: number;
  currency: string;
  landed: 'wallet' | 'sent';
  preferredLanguage?: string | null;
}): { title: string; body: string } {
  const fr = normalizeLocale(params.preferredLanguage) === 'fr';
  const amount = formatRentalAmount(params.amount, params.currency, fr ? 'fr' : 'en');
  if (params.landed === 'sent') return sentRefundNotice(fr, amount);
  return walletRefundNotice(fr, amount);
}

function walletRefundNotice(fr: boolean, amount: string): { title: string; body: string } {
  return {
    title: fr ? 'Remboursement dans votre portefeuille' : 'Refund in your wallet',
    body: fr
      ? `Votre remboursement de ${amount} est dans votre portefeuille Rendasua.`
      : `Your refund of ${amount} is in your Rendasua wallet.`,
  };
}

function sentRefundNotice(fr: boolean, amount: string): { title: string; body: string } {
  return {
    title: fr ? 'Remboursement envoyé' : 'Refund sent',
    body: fr
      ? `Votre remboursement de ${amount} a été envoyé sur votre numéro Mobile Money.`
      : `Your refund of ${amount} was sent to your Mobile Money number.`,
  };
}
