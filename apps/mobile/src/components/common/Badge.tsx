import { useTheme } from '@/contexts/ThemeContext';
import { StatusPill } from './StatusPill';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

type Props = {
  label: string;
  tone?: BadgeTone;
  compact?: boolean;
};

/** Short status label. Built on StatusPill so iOS does not clip the text. */
export function Badge({ label, tone = 'neutral', compact = true }: Props) {
  const { colors } = useTheme();
  const palette = toneColors(colors, tone);
  return (
    <StatusPill
      label={label}
      compact={compact}
      backgroundColor={palette.background}
      textColor={palette.text}
    />
  );
}

function toneColors(
  colors: ReturnType<typeof useTheme>['colors'],
  tone: BadgeTone
): { background: string; text: string } {
  if (tone === 'primary') return { background: colors.primarySubtle, text: colors.primary.main };
  if (tone === 'success') return { background: colors.successTint, text: colors.success.dark };
  if (tone === 'warning') return { background: colors.warningTint, text: colors.warning.dark };
  if (tone === 'error') return { background: colors.errorTint, text: colors.error.dark };
  if (tone === 'info') return { background: colors.infoTint, text: colors.info.dark };
  return { background: colors.surfaceInput, text: colors.text.secondary };
}
