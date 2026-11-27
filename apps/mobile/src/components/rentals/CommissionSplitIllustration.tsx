import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  /** Commission as a share of the rental subtotal, 0 to 1. */
  commissionShare: number;
  label: string;
}

const WIDTH = 240;
const BAR_X = 8;
const BAR_W = WIDTH - 16;

/** One bar split between what the business keeps and what Rendasua takes. */
export function CommissionSplitIllustration({ commissionShare, label }: Props) {
  const { colors } = useTheme();
  const share = Math.min(1, Math.max(0, commissionShare));
  const feeW = Math.max(share > 0 ? 6 : 0, BAR_W * share);
  const keepW = BAR_W - feeW;
  return (
    <Svg
      accessibilityRole="image"
      accessibilityLabel={label}
      width="100%"
      height={28}
      viewBox={`0 0 ${WIDTH} 28`}
    >
      <Rect x={BAR_X} y={6} width={keepW} height={16} rx={8} fill={colors.success.main} />
      {feeW > 0 ? (
        <Rect x={BAR_X + keepW - 8} y={6} width={feeW + 8} height={16} rx={8} fill={colors.primary.main} />
      ) : null}
      <Rect x={BAR_X + keepW - 8} y={6} width={8} height={16} fill={colors.success.main} />
    </Svg>
  );
}
