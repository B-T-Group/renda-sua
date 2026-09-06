import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../contexts/ThemeContext';
import { OnboardingSkipButton } from '../../../components/onboarding/OnboardingSkipButton';
import { OnboardingBulletRow } from '../../../components/onboarding/OnboardingBulletRow';
import { PaymentMethodsList } from '../../../components/onboarding/PaymentMethodsList';
import { PersonaIntentPane } from '../../../components/onboarding/PersonaIntentPane';
import { LanguageFlagToggle } from '../../../components/common/LanguageFlagToggle';
import { OnboardingMarketplaceIllustration } from '../../../components/illustrations/OnboardingMarketplaceIllustration';
import { OnboardingMerchantIllustration } from '../../../components/illustrations/OnboardingMerchantIllustration';
import { OnboardingPaymentsIllustration } from '../../../components/illustrations/OnboardingPaymentsIllustration';
import {
  useFirstRunOnboarding,
  type OnboardingFinishResult,
  type OnboardingPage,
} from './useFirstRunOnboarding';

type Props = {
  onFinished: (result: OnboardingFinishResult) => void;
};

function FirstRunOnboardingScreenBase({ onFinished }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const {
    width,
    pages,
    index,
    isIntent,
    showSkip,
    marketplaceBullets,
    merchantBullets,
    onIndexChange,
    onSkip,
    onSelectIntent,
    ctaLabel,
  } = useFirstRunOnboarding({ onFinished });

  const scrollTo = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(0, next), pages.length - 1);
      listRef.current?.scrollToIndex({ index: clamped, animated: true });
      onIndexChange(clamped);
    },
    [onIndexChange, pages.length]
  );

  const handleContinue = useCallback(() => {
    if (isIntent) return;
    scrollTo(index + 1);
  }, [index, isIntent, scrollTo]);

  const handleSkip = useCallback(() => {
    onSkip();
    scrollTo(pages.length - 1);
  }, [onSkip, pages.length, scrollTo]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) {
        scrollTo(index - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [index, scrollTo]);

  const renderItem = useCallback(
    ({ item }: { item: OnboardingPage }) => {
      if (item.kind === 'intent') {
        return <PersonaIntentPane width={width} onSelect={onSelectIntent} />;
      }
      if (item.id === 'marketplace') {
        return (
          <ScrollView
            style={{ width }}
            contentContainerStyle={[
              styles.slide,
              { paddingHorizontal: spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.art}>
              <OnboardingMarketplaceIllustration />
            </View>
            <Text
              style={[
                styles.title,
                typography.display,
                { color: colors.text.primary },
              ]}
            >
              {t(
                'ftue.onboarding.slide1.title',
                'Discover the best businesses near you'
              )}
            </Text>
            {marketplaceBullets.map((b) => (
              <OnboardingBulletRow key={b.text} icon={b.icon} text={b.text} />
            ))}
          </ScrollView>
        );
      }
      if (item.id === 'merchant') {
        return (
          <ScrollView
            style={{ width }}
            contentContainerStyle={[
              styles.slide,
              { paddingHorizontal: spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.art}>
              <OnboardingMerchantIllustration />
            </View>
            <Text
              style={[
                styles.title,
                typography.display,
                { color: colors.text.primary },
              ]}
            >
              {t(
                'ftue.onboarding.slide2.title',
                'Grow your business with RendaSua'
              )}
            </Text>
            {merchantBullets.map((b) => (
              <OnboardingBulletRow key={b.text} icon={b.icon} text={b.text} />
            ))}
          </ScrollView>
        );
      }
      return (
        <ScrollView
          style={{ width }}
          contentContainerStyle={[
            styles.slide,
            { paddingHorizontal: spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.art}>
            <OnboardingPaymentsIllustration />
          </View>
          <Text
            style={[
              styles.title,
              typography.display,
              { color: colors.text.primary },
            ]}
          >
            {t('ftue.onboarding.slide3.title', 'Shop the way you want')}
          </Text>
          <PaymentMethodsList />
        </ScrollView>
      );
    },
    [
      colors.text.primary,
      marketplaceBullets,
      merchantBullets,
      onSelectIntent,
      spacing.lg,
      t,
      typography.display,
      width,
    ]
  );

  const dots = useMemo(
    () =>
      pages.map((p, i) => (
        <View
          key={p.id}
          style={[
            styles.dot,
            {
              backgroundColor:
                i === index ? colors.primary.main : colors.divider,
            },
          ]}
        />
      )),
    [colors.divider, colors.primary.main, index, pages]
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.pageBackground,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
        },
      ]}
    >
      <View style={[styles.topBar, { paddingHorizontal: spacing.md }]}>
        <LanguageFlagToggle />
        <View style={{ flex: 1 }} />
        <OnboardingSkipButton
          visible={showSkip && !isIntent}
          onPress={handleSkip}
        />
      </View>

      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const w = e.nativeEvent.layoutMeasurement.width || width;
          onIndexChange(Math.round(e.nativeEvent.contentOffset.x / w));
        }}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        renderItem={renderItem}
        style={styles.pager}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 50);
        }}
      />

      <View
        style={[
          styles.footer,
          { paddingHorizontal: spacing.lg, gap: spacing.sm },
        ]}
      >
        <View style={styles.dotsRow}>{dots}</View>
        {!isIntent ? (
          <Button
            mode="contained"
            onPress={handleContinue}
            contentStyle={styles.cta}
          >
            {ctaLabel}
          </Button>
        ) : null}
      </View>
    </View>
  );
}

export const FirstRunOnboardingScreen = observer(FirstRunOnboardingScreenBase);
export default FirstRunOnboardingScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  pager: { flex: 1 },
  slide: { flexGrow: 1, justifyContent: 'center', paddingBottom: 16 },
  art: { alignItems: 'center', marginBottom: 20 },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  footer: { paddingTop: 8 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: { minHeight: 48 },
});
