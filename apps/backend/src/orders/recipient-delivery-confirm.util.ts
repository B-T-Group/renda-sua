const RECEIVED_BUTTONS = new Set([
  'received',
  'reçu',
  'recu',
  'gift_received',
]);

const PROBLEM_BUTTONS = new Set([
  'problem',
  'problème',
  'probleme',
  'gift_problem',
]);

export function isRecipientDeliveryProblemButton(
  buttonId?: string,
  buttonTitle?: string
): boolean {
  const id = (buttonId || '').trim().toLowerCase();
  const title = (buttonTitle || '').trim().toLowerCase();
  return PROBLEM_BUTTONS.has(id) || PROBLEM_BUTTONS.has(title);
}

export function isRecipientDeliveryConfirmButton(
  buttonId?: string,
  buttonTitle?: string
): boolean {
  const id = (buttonId || '').trim().toLowerCase();
  const title = (buttonTitle || '').trim().toLowerCase();
  return (
    RECEIVED_BUTTONS.has(id) ||
    RECEIVED_BUTTONS.has(title) ||
    isRecipientDeliveryProblemButton(buttonId, buttonTitle)
  );
}
