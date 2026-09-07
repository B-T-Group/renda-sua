import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { observer } from 'mobx-react-lite';
import Logo from '../Logo';
import { StatusPill } from '../common/StatusPill';
import { PagedCarousel } from '../common/PagedCarousel';
import { ClientHomeOrdersStrip } from '../client/ClientHomeOrdersStrip';
import { CatalogTrustStrip } from './CatalogTrustStrip';
import type { Order } from '../../types/agent';
import { HeroCarouselSlide } from './HeroCarousel/HeroCarouselSlide';
import {
  buildHeroSlides,
  type HeroSlideConfig,
  type HeroSlideId,
} from './HeroCarousel/heroSlideConfig';
import type { Theme } from '../../theme';
import { useStore } from '../../stores/RootStore';
import { countrySupportsStripe, useSupportedCountries } from '../../hooks/useSupportedCountries';
import { trackHeroSlideViewed } from '../../utils/ftueAnalytics';

export interface CatalogBrowseHeroProps {
  scrollY: Animated.Value;
  theme: Theme;
  isWideHero: boolean;
  resultsLabel: string;
  total: number;
  homeOrders?: Order[];
  homeOrdersTotalActive?: number;
  onOpenHomeOrder?: (order: Order) => void;
  onSeeAllHomeOrders?: () => void;
  nearbyAgentsCount?: number;
  onHeroSlidePress?: (slideId: HeroSlideId) => void;
}

function CatalogBrowseHeroBase({
  scrollY,
  theme,
  isWideHero,
  resultsLabel,
  total,
  homeOrders,
  homeOrdersTotalActive = 0,
  onOpenHomeOrder,
  onSeeAllHomeOrders,
  nearbyAgentsCount = 0,
  onHeroSlidePress,
}: CatalogBrowseHeroProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing, shadows } = theme;
  const { width: windowWidth } = useWindowDimensions();
  const { ftue, persona, market } = useStore();
  const { countries } = useSupportedCountries();
  // Content width inside hero padding (list header already applies spacing.md).
  const [carouselWidth, setCarouselWidth] = useState(
    Math.max(0, windowWidth - spacing.md * 2 - spacing.md * 2)
  );

  const isStripe = countrySupportsStripe(countries, market.selectedCountryCode);
  const slides = useMemo(
    () =>
      buildHeroSlides({
        personaIntent: ftue.personaIntent,
        activePersona: persona.activePersona,
        showMobileMoney: !isStripe,
        showAiTokens: persona.activePersona !== 'agent',
      }),
    [ftue.personaIntent, isStripe, persona.activePersona]
  );

  const subtitleOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 56],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  // Keep horizontal inset stable so the carousel page width stays correct;
  // only shrink vertical padding on scroll.
  const heroPadV = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [spacing.md, spacing.sm],
        extrapolate: 'clamp',
      }),
    [scrollY, spacing.md, spacing.sm]
  );

  const textAlign = isWideHero ? ('left' as const) : ('center' as const);

  useEffect(() => {
    if (slides[0]) {
      trackHeroSlideViewed(slides[0].id, 0, {
        persona_intent: ftue.personaIntent,
      });
    }
  }, [ftue.personaIntent, slides]);

  const onIndexChange = useCallback(
    (index: number) => {
      const slide = slides[index];
      if (slide) {
        trackHeroSlideViewed(slide.id, index, {
          persona_intent: ftue.personaIntent,
        });
      }
    },
    [ftue.personaIntent, slides]
  );

  const renderSlide = useCallback(
    ({ item, width }: { item: HeroSlideConfig; width: number }) => (
      <HeroCarouselSlide
        slide={item}
        width={width}
        onPress={() => onHeroSlidePress?.(item.id)}
      />
    ),
    [onHeroSlidePress]
  );

  return (
    <View
      style={[
        styles.hero,
        shadows.sm,
        {
          borderRadius: borderRadius.lg,
          borderColor: colors.primary.main + '33',
          backgroundColor: colors.primaryTint,
        },
      ]}
    >
      <View
        style={[
          styles.heroSheen,
          { backgroundColor: colors.primary.main, opacity: 0.08 },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.heroBlobPrimary,
          { backgroundColor: colors.primary.light, opacity: 0.22 },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.heroBlobSecondary,
          { backgroundColor: colors.secondary.light, opacity: 0.2 },
        ]}
        pointerEvents="none"
      />

      <Animated.View
        style={[
          styles.heroInner,
          {
            paddingTop: heroPadV,
            paddingBottom: heroPadV,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View
          style={[
            styles.heroLayout,
            isWideHero ? styles.heroLayoutWide : styles.heroLayoutNarrow,
          ]}
        >
          <View
            style={[
              styles.heroMain,
              isWideHero ? styles.heroMainWide : styles.heroMainNarrow,
            ]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - carouselWidth) > 1) {
                setCarouselWidth(w);
              }
            }}
          >
            <View style={styles.heroLogoWrap}>
              <Logo variant="compact" />
            </View>

            <Text
              variant="labelMedium"
              style={[
                styles.kicker,
                {
                  color: colors.primary.main,
                  marginTop: spacing.xs,
                  textAlign,
                },
              ]}
            >
              {t('public.items.heroKicker', 'Your local marketplace')}
            </Text>

            <Animated.View style={{ opacity: subtitleOpacity, width: '100%' }}>
              <Text
                variant="bodySmall"
                style={[
                  styles.subtitle,
                  {
                    color: colors.text.secondary,
                    marginTop: spacing.xxs,
                    textAlign,
                  },
                  !isWideHero && styles.subtitleNarrow,
                ]}
              >
                {t(
                  'public.items.heroSubtitle',
                  'Discover great products from local businesses'
                )}
              </Text>
            </Animated.View>

            {slides.length > 0 && carouselWidth > 0 ? (
              <View style={{ marginTop: spacing.md, width: '100%' }}>
                <PagedCarousel
                  data={slides}
                  keyExtractor={(s) => s.id}
                  renderItem={renderSlide}
                  pageWidth={carouselWidth}
                  onIndexChange={onIndexChange}
                  accessibilityLabelForIndex={(i, total) =>
                    t('ftue.hero.pageLabel', 'Promo {{current}} of {{total}}', {
                      current: i + 1,
                      total,
                    })
                  }
                />
              </View>
            ) : null}

            <View style={{ marginTop: spacing.md, width: '100%' }}>
              <CatalogTrustStrip />
            </View>

            {nearbyAgentsCount > 0 ? (
              <View
                style={[
                  styles.agentsPillWrap,
                  { marginTop: spacing.sm },
                  isWideHero ? styles.agentsPillWrapWide : styles.agentsPillWrapNarrow,
                ]}
              >
                <StatusPill
                  icon="moped"
                  leadingDot
                  label={t(
                    'public.items.agentsNearby',
                    '{{count}} delivery agents near you',
                    { count: nearbyAgentsCount }
                  )}
                  backgroundColor={colors.success.main}
                  textColor={colors.primary.contrast}
                  style={[
                    styles.agentsPill,
                    isWideHero
                      ? styles.agentsPillAlignWide
                      : styles.agentsPillAlignNarrow,
                  ]}
                />
              </View>
            ) : null}

            {!isWideHero ? (
              <View style={[styles.statWrap, { marginTop: spacing.sm }]}>
                <HeroStatChip
                  resultsLabel={resultsLabel}
                  total={total}
                  colors={colors}
                />
              </View>
            ) : null}
          </View>

          {isWideHero ? (
            <View style={styles.heroAside}>
              <HeroStatChip
                resultsLabel={resultsLabel}
                total={total}
                colors={colors}
              />
            </View>
          ) : null}
        </View>

        {homeOrders && homeOrders.length > 0 && onOpenHomeOrder ? (
          <ClientHomeOrdersStrip
            orders={homeOrders}
            totalActive={homeOrdersTotalActive}
            onOpenOrder={onOpenHomeOrder}
            onSeeAll={onSeeAllHomeOrders}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

function HeroStatChip({
  resultsLabel,
  total,
  colors,
}: {
  resultsLabel: string;
  total: number;
  colors: Theme['colors'];
}) {
  const hasResults = total > 0;

  return (
    <StatusPill
      icon={hasResults ? 'check-circle' : 'storefront-outline'}
      label={resultsLabel}
      backgroundColor={hasResults ? colors.primary.main : colors.primaryTint}
      textColor={hasResults ? colors.primary.contrast : colors.primary.main}
    />
  );
}

export const CatalogBrowseHero = memo(observer(CatalogBrowseHeroBase));

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBlobPrimary: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -72,
    right: -56,
  },
  heroBlobSecondary: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    bottom: -48,
    left: -40,
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
  },
  heroLayout: {
    gap: 16,
  },
  heroLayoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroLayoutNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroMain: {
    minWidth: 0,
  },
  heroMainWide: {
    flex: 1,
    paddingRight: 12,
  },
  heroMainNarrow: {
    width: '100%',
    alignItems: 'center',
  },
  heroLogoWrap: {
    width: '100%',
    alignItems: 'center',
  },
  heroAside: {
    paddingTop: 4,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  kicker: {
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitle: {
    lineHeight: 22,
    maxWidth: 340,
  },
  subtitleNarrow: {
    alignSelf: 'center',
  },
  statWrap: {
    alignItems: 'center',
    width: '100%',
  },
  agentsPillWrap: {
    width: '100%',
  },
  agentsPillWrapWide: {
    alignItems: 'flex-start',
  },
  agentsPillWrapNarrow: {
    alignItems: 'center',
  },
  agentsPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  agentsPillAlignWide: {
    alignSelf: 'flex-start',
  },
  agentsPillAlignNarrow: {
    alignSelf: 'center',
  },
});
