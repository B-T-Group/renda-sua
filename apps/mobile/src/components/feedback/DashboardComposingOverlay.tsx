import LottieView, { type AnimationObject } from 'lottie-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import type { DashboardComposingPersona } from '../../hooks/useDashboardComposingSession';
import { PersonaPickIllustration } from '../illustrations/PersonaPickIllustration';
import { IndeterminateCircularVectorLoader } from './IndeterminateCircularVectorLoader';

const CLIENT_LOTTIE =
  require('../../../assets/animations/dashboard-client.json') as AnimationObject;
const AGENT_LOTTIE =
  require('../../../assets/animations/dashboard-agent.json') as AnimationObject;
const BUSINESS_LOTTIE =
  require('../../../assets/animations/dashboard-business.json') as AnimationObject;

const ANIM_SIZE = 180;

type CopyKey = {
  headline: string;
  headlineDefault: string;
  lines: Array<{ key: string; fallback: string }>;
};

const COPY: Record<DashboardComposingPersona, CopyKey> = {
  client: {
    headline: 'dashboardComposing.client.headline',
    headlineDefault: 'Building your personalized dashboard',
    lines: [
      {
        key: 'dashboardComposing.client.line1',
        fallback: 'Finding shops near you',
      },
      {
        key: 'dashboardComposing.client.line2',
        fallback: "Preparing today's picks",
      },
      {
        key: 'dashboardComposing.client.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  agent: {
    headline: 'dashboardComposing.agent.headline',
    headlineDefault: 'Preparing your delivery board',
    lines: [
      {
        key: 'dashboardComposing.agent.line1',
        fallback: 'Checking nearby orders',
      },
      {
        key: 'dashboardComposing.agent.line2',
        fallback: 'Getting your routes ready',
      },
      {
        key: 'dashboardComposing.agent.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  business: {
    headline: 'dashboardComposing.business.headline',
    headlineDefault: 'Setting up your store',
    lines: [
      {
        key: 'dashboardComposing.business.line1',
        fallback: "Gathering today's orders",
      },
      {
        key: 'dashboardComposing.business.line2',
        fallback: 'Arranging your dashboard',
      },
      {
        key: 'dashboardComposing.business.line3',
        fallback: 'Almost ready',
      },
    ],
  },
  delegate: {
    headline: 'dashboardComposing.delegate.headline',
    headlineDefault: 'Opening this location',
    lines: [
      {
        key: 'dashboardComposing.delegate.line1',
        fallback: 'Loading orders and inventory',
      },
      {
        key: 'dashboardComposing.delegate.line2',
        fallback: 'Almost ready',
      },
    ],
  },
};

const LOTTIE: Record<DashboardComposingPersona, AnimationObject> = {
  client: CLIENT_LOTTIE,
  agent: AGENT_LOTTIE,
  business: BUSINESS_LOTTIE,
  delegate: BUSINESS_LOTTIE,
};

/** Business / delegate wash — matches web Trust Coast CTA accent. */
const BUSINESS_ACCENT = '#C2410C';

function accentFor(
  persona: DashboardComposingPersona,
  colors: ReturnType<typeof useTheme>['colors']
): string {
  if (persona === 'agent') return colors.secondary.main;
  if (persona === 'business' || persona === 'delegate') return BUSINESS_ACCENT;
  return colors.primary.main;
}

type Props = {
  persona: DashboardComposingPersona;
};

export function DashboardComposingOverlay({ persona }: Props) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const copy = COPY[persona];
  const accent = accentFor(persona, colors);
  const [lineIndex, setLineIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || copy.lines.length <= 1) return;
    const id = setInterval(() => {
      setLineIndex((i) => (i + 1) % copy.lines.length);
    }, 2000);
    return () => clearInterval(id);
  }, [copy.lines.length, reduceMotion]);

  const line = copy.lines[lineIndex] ?? copy.lines[0];
  const headline = t(copy.headline, copy.headlineDefault);
  const wash = useMemo(() => `${accent}18`, [accent]);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          paddingHorizontal: spacing.lg,
        },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={headline}
      accessibilityState={{ busy: true }}
    >
      <View
        pointerEvents="none"
        style={[
          styles.wash,
          { backgroundColor: wash, borderRadius: borderRadius.full },
        ]}
      />
      <View style={styles.animWrap} accessible={false}>
        {reduceMotion ? (
          <PersonaPickIllustration
            persona={persona === 'delegate' ? 'business' : persona}
            accent={accent}
            size={ANIM_SIZE * 0.7}
            animate={false}
          />
        ) : (
          <LottieView
            source={LOTTIE[persona]}
            autoPlay
            loop
            style={{ width: ANIM_SIZE, height: ANIM_SIZE }}
          />
        )}
      </View>

      <Text
        style={[
          typography.subtitle1,
          {
            color: colors.text.primary,
            textAlign: 'center',
            marginTop: spacing.md,
            fontWeight: '600',
          },
        ]}
      >
        {headline}
      </Text>

      <Text
        accessibilityLiveRegion="polite"
        style={[
          typography.body2,
          {
            color: colors.text.secondary,
            textAlign: 'center',
            marginTop: spacing.sm,
            minHeight: 22,
          },
        ]}
      >
        {t(line.key, line.fallback)}
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <IndeterminateCircularVectorLoader
          color={accent}
          running
          size={28}
          strokeWidth={3}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wash: {
    position: 'absolute',
    width: 280,
    height: 280,
    top: '28%',
    opacity: 0.55,
  },
  animWrap: {
    width: ANIM_SIZE,
    height: ANIM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
