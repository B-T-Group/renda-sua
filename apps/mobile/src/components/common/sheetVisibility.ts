export type SheetVisibilityCommand = 'present' | 'dismiss' | 'none';

/**
 * Gorhom leaves a modal stuck in DISMISSING when dismiss() runs before the
 * sheet has mounted, or after it has already closed. The next present() then
 * renders nothing. Only dismiss a sheet this screen actually opened.
 */
export function sheetVisibilityCommand(
  visible: boolean,
  hasOpened: boolean,
  closedBySheet: boolean
): SheetVisibilityCommand {
  if (visible) return 'present';
  if (!hasOpened || closedBySheet) return 'none';
  return 'dismiss';
}
