import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReelAiSubmittedIllustration } from '@/components/illustrations/ReelAiSubmittedIllustration';
import { useTheme } from '@/contexts/ThemeContext';
import type { BusinessRootStackParamList } from '@/navigation/types';

const STEPS = [
  {
    icon: 'movie-open-outline' as const,
    titleKey: 'business.reels.submitted.generateTitle',
    titleDefault: 'We are making the video',
    bodyKey: 'business.reels.submitted.generateBody',
    bodyDefault:
      'Your 8-second product ad is generating now. This can take about a minute.',
  },
  {
    icon: 'cog-outline' as const,
    titleKey: 'business.reels.submitted.processTitle',
    titleDefault: 'We prepare it for the feed',
    bodyKey: 'business.reels.submitted.processBody',
    bodyDefault: 'Once the clip is ready, we process it so it plays smoothly in Reels.',
  },
  {
    icon: 'play-circle-outline' as const,
    titleKey: 'business.reels.submitted.liveTitle',
    titleDefault: 'It goes live',
    bodyKey: 'business.reels.submitted.liveBody',
    bodyDefault:
      'AI reels publish automatically after processing. Shoppers can see it in the Reels feed.',
  },
];

export default function BusinessReelAiSubmittedScreen() {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      headerLeft: () => null,
      gestureEnabled: false,
    });
  }, [navigation]);

  const goDashboard = () =>
    navigation.navigate('BusinessMainTabs', { screen: 'BusinessDashboard' });
  const goReels = () =>
    navigation.navigate('BusinessMainTabs', { screen: 'BusinessReels' });

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{
          padding: spacing.md,
          paddingBottom: spacing.lg,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <ReelAiSubmittedIllustration
            accessibilityLabel={t(
              'business.reels.submitted.illustrationLabel',
              'Reel submitted and waiting to go live'
            )}
          />
          <Text
            style={[
              typography.h5,
              {
                color: colors.text.primary,
                textAlign: 'center',
                marginTop: spacing.sm,
              },
            ]}
          >
            {t(
              'business.reels.submitted.headline',
              'Your AI reel is on its way'
            )}
          </Text>
          <Text
            style={[
              typography.body2,
              {
                color: colors.text.secondary,
                textAlign: 'center',
                marginTop: spacing.xs,
              },
            ]}
          >
            {t(
              'business.reels.submitted.intro',
              'Here is what happens before shoppers can see it.'
            )}
          </Text>
        </View>

        {STEPS.map((step) => (
          <View
            key={step.titleKey}
            style={[
              styles.card,
              shadows.sm,
              {
                borderColor: colors.divider,
                backgroundColor: colors.surface,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              },
            ]}
          >
            <View style={styles.row}>
              <MaterialCommunityIcons
                name={step.icon}
                size={22}
                color={colors.primary.main}
              />
              <Text
                style={[
                  typography.subtitle2,
                  {
                    color: colors.text.primary,
                    marginLeft: spacing.sm,
                    flex: 1,
                  },
                ]}
              >
                {t(step.titleKey, step.titleDefault)}
              </Text>
            </View>
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, marginTop: spacing.xs },
              ]}
            >
              {t(step.bodyKey, step.bodyDefault)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.divider,
          backgroundColor: colors.pageBackground,
          gap: spacing.xs,
        }}
      >
        <Button mode="contained" onPress={goDashboard}>
          {t(
            'business.reels.submitted.returnToDashboard',
            'Return to dashboard'
          )}
        </Button>
        <Button mode="text" onPress={goReels}>
          {t('business.reels.submitted.viewReels', 'View reels')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
