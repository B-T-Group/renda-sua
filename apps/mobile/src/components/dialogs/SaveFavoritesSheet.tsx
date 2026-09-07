import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { FavoritesIllustration } from '../illustrations/FavoritesIllustration';
import {
  navigateToGuestSignup,
  rootNavigationRef,
} from '../../navigation/rootNavigationRef';

export interface SaveFavoritesSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onBeginAuth: () => void | Promise<void>;
}

function navigateToGuestLogin(): void {
  if (!rootNavigationRef.isReady()) return;
  const routeNames = rootNavigationRef.getRootState()?.routeNames ?? [];
  if (routeNames.includes('GuestTabs')) {
    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: 'GuestTabs',
        params: {
          screen: 'GuestAuth',
          params: { screen: 'Login' },
        },
      })
    );
    return;
  }
  rootNavigationRef.dispatch(
    CommonActions.navigate({
      name: 'GuestAuth',
      params: { screen: 'Login' },
    })
  );
}

export function SaveFavoritesSheet({
  visible,
  onDismiss,
  onBeginAuth,
}: SaveFavoritesSheetProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const goLogin = async () => {
    await onBeginAuth();
    navigateToGuestLogin();
  };

  const goSignup = async () => {
    await onBeginAuth();
    navigateToGuestSignup({ preselectedPersona: 'client', source: 'nudge' });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.sheet,
            shadows.md,
            {
              borderRadius: borderRadius.xl,
              backgroundColor: colors.background.paper,
              paddingBottom: Math.max(insets.bottom, spacing.md),
              maxHeight: screenHeight * 0.85,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
            <FavoritesIllustration size={96} />
          </View>
          <Text
            variant="titleLarge"
            style={[typography.h3, { textAlign: 'center', marginBottom: spacing.xs }]}
          >
            {t('items.likes.saveTitle', 'Save your favorites')}
          </Text>
          <Text
            style={[
              typography.body2,
              {
                color: colors.text.secondary,
                textAlign: 'center',
                marginBottom: spacing.md,
              },
            ]}
          >
            {t(
              'items.likes.saveBenefits',
              'Create an account to keep your likes, get restock alerts, and personalized picks.'
            )}
          </Text>
          <View style={styles.actions}>
            <Button mode="outlined" onPress={() => void goLogin()} style={styles.btn}>
              {t('auth.login', 'Sign in')}
            </Button>
            <Button mode="contained" onPress={() => void goSignup()} style={styles.btn}>
              {t('auth.signup', 'Sign up')}
            </Button>
          </View>
          <Button mode="text" onPress={onDismiss}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  btn: {
    flex: 1,
  },
});
