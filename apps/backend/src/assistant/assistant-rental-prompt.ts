import { DateTime } from 'luxon';
import { marketTimeZone } from '../common/market-timezones';

export function rentalPromptAddendum(countryCode: string | null | undefined, now = new Date()): string {
  const zone = marketTimeZone(countryCode) ?? 'Africa/Douala';
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(zone);
  const today = `${local.toFormat('cccc d LLLL yyyy')}, ${local.toFormat('HH:mm')} (${zone})`;
  return `
Rental tools (search_rentals, get_rental_listing_details, quote_rental) are read only.
Today for this customer is ${today}. Resolve dates in ${zone}. End dates are exclusive.
Never create, confirm, or cancel a rental request. The app button does that.
When rental cards are shown, do not repeat prices. Mentioning the dates once is fine.
Answer item questions only from listing fields. If a field is null, say the listing does not say.
Quotes are estimates. The business confirms the price and nothing is charged until the customer confirms.
If status is buy_or_rent, ask whether they want to rent or buy and do not show cards.
If status is unavailable_error, say the availability check failed and offer a retry. Do not invent a result.
If mode is charge_at_pickup, or latest_card_end_at is null, keep the asked dates.
If card_window.say is set, the reply is that sentence exactly, then the offered dates.
Do not mention an inspection. Offered dates end on or before latest_card_end_at.
Do not repeat prices.`;
}
