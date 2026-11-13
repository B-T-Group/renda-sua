const MONEY = /\d[\d\s\u00A0.,]*\s*(?:FCFA|XAF|XOF|CAD|USD|EUR|€)/gi;
const AVAILABILITY_CLAIM =
  /\b(available|unavailable|disponible|booked|réservé|reserve|free from|libre à partir|libre a partir)\b/gi;

/** Tools the model must never receive. Request creation stays a button in the app. */
export const FORBIDDEN_RENTAL_WRITE_TOOLS = [
  'create_rental_request',
  'cancel_rental_request',
  'update_rental_request',
  'confirm_rental_booking',
] as const;

export function listedToolNames(tools: Array<{ toolSpec?: { name?: string } } | undefined>): string[] {
  return tools.map((tool) => tool?.toolSpec?.name).filter((name): name is string => !!name);
}

export function assertModelCannotCreateRentalRequests(names: string[]): void {
  const blocked = names.filter(
    (name) =>
      (FORBIDDEN_RENTAL_WRITE_TOOLS as readonly string[]).includes(name) ||
      /create_.*rental_request/i.test(name)
  );
  if (blocked.length) {
    throw new Error(`Rental write tools are not model tools: ${blocked.join(', ')}`);
  }
}

export function sanitizeRentalModelText(
  text: string,
  options: { rentalCards: boolean; rentalGrounded: boolean; rentalIntent: boolean }
): string {
  if (!options.rentalCards && !options.rentalIntent) return text.trim();
  let out = text;
  if (options.rentalCards || !options.rentalGrounded) out = stripMoney(out);
  if (options.rentalIntent && !options.rentalGrounded) out = stripClaims(out);
  if (options.rentalCards) out = firstSentences(out, 2);
  return out.replace(/[ ]{2,}/g, ' ').trim();
}

function stripMoney(text: string): string {
  return text.replace(MONEY, '').replace(/\s+([,.])/g, '$1');
}

function stripClaims(text: string): string {
  return text.replace(AVAILABILITY_CLAIM, '');
}

function firstSentences(text: string, count: number): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.slice(0, count).join(' ');
}
