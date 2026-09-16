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
    icon: 'cloud-upload-outline' as const,
    titleKey: 'business.reels.uploadSubmitted.processTitle',
    titleDefault: 'Processing in the background',
    bodyKey: 'business.reels.uploadSubmitted.processBody',
    bodyDefault:
      'We’re preparing your video so it plays smoothly in Reels. You can leave this screen.',
  },
  {
    icon: 'shield-check-outline' as const,
    titleKey: 'business.reels.uploadSubmitted.reviewTitle',
    titleDefault: 'Pending approval',
    bodyKey: 'business.reels.uploadSubmitted.reviewBody',
    bodyDefault:
      'Uploaded reels are reviewed before they appear in the public feed.',
  },
  {
    icon: 'bell-outline' as const,
    titleKey: 'business.reels.uploadSubmitted.notifyTitle',
    titleDefault: 'We’ll notify you',
    bodyKey: 'business.reels.uploadSubmitted.notifyBody',
    bodyDefault:
      'You’ll get a notification when your reel is approved—or if it needs changes.',
  },
];

export default function BusinessReelUploadSubmittedScreen() {
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
              'business.reels.uploadSubmitted.illustrationLabel',
              'Reel uploaded and waiting for approval'
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
              'business.reels.uploadSubmitted.headline',
              'Your reel was submitted'
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
              'business.reels.uploadSubmitted.intro',
              'Here’s what happens next.'
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
