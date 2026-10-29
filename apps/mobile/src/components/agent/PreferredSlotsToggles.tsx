/**
 * #594 addendum §3.1/§3.2: icon-first preferred-slot toggles (☀ ◐ ☾), the
 * all-off banner (AC-P6), the slot-off confirm dialog (AC-P3/P4) and the toast.
 * `variant="large"` is Settings → Availability; `variant="chips"` is the
 * Dedicated tab chip row. Both read the same useSlotPreferences state.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing } from '../../theme/spacing';
import type { SlotPreferencesState } from '../../hooks/useSlotPreferences';
import { SLOT_KEYS, SLOT_PREF_ICONS } from '../../utils/slotPrefs';

interface Props {
  state: SlotPreferencesState;
  variant?: 'large' | 'chips';
}

export default function PreferredSlotsToggles({ state, variant = 'large' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { prefs, allOff, savingSlot, pending, message, setSlot, confirmPending, cancelPending, clearMessage, slotLabel } =
    state;
  const large = variant === 'large';

  return (
    <View>
      <View style={[styles.row, !large && styles.chipRow]} accessibilityRole="radiogroup">
        {SLOT_KEYS.map((slot) => {
          const on = !!prefs?.[slot];
          const label = slotLabel(slot);
          const tint = on ? colors.primary.main : colors.text.disabled;
          return (
            <Pressable
              key={slot}
              testID={`slot-toggle-${slot}`}
              accessibilityRole="switch"
              accessibilityState={{ checked: on, disabled: !prefs || savingSlot === slot }}
              accessibilityLabel={t(on ? 'slotPrefs.a11yOn' : 'slotPrefs.a11yOff', { slot: label })}
              disabled={!prefs || savingSlot === slot}
              onPress={() => setSlot(slot, !on)}
              style={[
                large ? styles.toggle : styles.chip,
                {
                  borderColor: tint,
                  backgroundColor: on ? colors.primary.main : 'transparent',
                  opacity: savingSlot === slot ? 0.6 : 1,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={SLOT_PREF_ICONS[slot] as any}
                size={large ? 32 : 18}
                color={on ? '#fff' : tint}
              />
              <Text
                variant={large ? 'labelMedium' : 'labelSmall'}
                style={{ color: on ? '#fff' : colors.text.secondary, marginTop: large ? spacing.xs : 0, marginLeft: large ? 0 : 4 }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {allOff && (
        <View
          testID="slot-prefs-all-off"
          accessibilityRole="alert"
          style={[styles.banner, { backgroundColor: colors.warningTint, borderColor: colors.warning.main }]}
        >
          <MaterialCommunityIcons name="alert-outline" size={18} color={colors.warning.dark} />
          <Text variant="bodySmall" style={{ flex: 1, marginLeft: spacing.sm, color: colors.text.primary }}>
            {t('slotPrefs.allOffBanner')}
          </Text>
        </View>
      )}

      <Portal>
        <Dialog visible={!!pending} onDismiss={cancelPending} testID="slot-off-confirm">
          {pending && (
            <>
              <Dialog.Title>{t('slotPrefs.confirmTitle', { slot: slotLabel(pending.slot) })}</Dialog.Title>
              <Dialog.Content>
                <Text variant="bodyMedium">
                  {t('slotPrefs.confirmBody', { slot: slotLabel(pending.slot), stores: state.pendingStoreNames })}
                </Text>
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={cancelPending}>{t('slotPrefs.keepOn')}</Button>
                <Button onPress={confirmPending}>{t('slotPrefs.confirmCta')}</Button>
              </Dialog.Actions>
            </>
          )}
        </Dialog>
        <Snackbar visible={!!message} onDismiss={clearMessage} duration={3000}>
          {message ?? ''}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  chipRow: { justifyContent: 'flex-start', gap: spacing.xs },
  toggle: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
});
