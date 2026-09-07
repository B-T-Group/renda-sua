import LottieView from "lottie-react-native";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useTheme } from "../../contexts/ThemeContext";
import { AppModal } from "../common/AppModal";
import {
  ACTION_CAPTION,
  ACTION_LOTTIE,
  ActionLoadingKind,
  normalizeActionLoading,
} from "./actionLoadingKinds";
import { IndeterminateCircularVectorLoader } from "./IndeterminateCircularVectorLoader";

type Props = {
  visible: boolean;
  action: ActionLoadingKind;
  /** Overrides the default localized caption for the action. */
  message?: string;
  subtitle?: string;
};

const ANIMATION_SIZE = 148;

/**
 * iOS-friendly modal loader that plays a per-action Lottie illustration with a
 * localized caption. Falls back to the indeterminate ring when an action has no
 * Lottie asset.
 */
export function ActionLoadingDialog({
  visible,
  action,
  message,
  subtitle,
}: Props) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();

  const normalized = normalizeActionLoading(action);
  const source = ACTION_LOTTIE[normalized];
  const caption = ACTION_CAPTION[normalized];
  const resolvedMessage = message ?? t(caption.key, caption.fallback);

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.scrim,
          { backgroundColor: `${colors.pageBackground}D9` },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.lg,
              paddingVertical: spacing.xl,
              paddingHorizontal: spacing.xl,
              shadowColor: "#000",
              shadowOpacity: 0.12,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            },
          ]}
        >
          <View
            style={styles.animWrap}
            accessibilityRole="progressbar"
            accessibilityLabel={resolvedMessage}
          >
            {source ? (
              <LottieView
                source={source}
                autoPlay
                loop
                style={{ width: ANIMATION_SIZE, height: ANIMATION_SIZE }}
              />
            ) : (
              <IndeterminateCircularVectorLoader
                color={colors.primary.main}
                running={visible}
                size={64}
                strokeWidth={4}
              />
            )}
          </View>
          <Text
            style={[
              typography.subtitle2,
              {
                color: colors.text.primary,
                textAlign: "center",
                marginTop: spacing.md,
              },
            ]}
          >
            {resolvedMessage}
          </Text>
          {subtitle ? (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.text.secondary,
                  textAlign: "center",
                  marginTop: spacing.xs,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    maxWidth: 320,
    width: "100%",
    alignItems: "center",
  },
  animWrap: {
    width: ANIMATION_SIZE,
    height: ANIMATION_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
});
