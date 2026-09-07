import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Button,
  Menu,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';
import { KeyboardAwareScrollView } from '../../components/layout/KeyboardAwareScrollView';
import { useBusinessRentalAddListing } from '../../hooks/business/useBusinessRentalAddListing';
import { useTheme } from '../../contexts/ThemeContext';

export default function BusinessRentalAddListingScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const props = useBusinessRentalAddListing();
  const {
    itemName,
    availableLocations,
    setLocationId,
    hourly,
    setHourly,
    daily,
    setDaily,
    deposit,
    setDeposit,
    units,
    setUnits,
    pickup,
    setPickup,
    dropoff,
    setDropoff,
    menuOpen,
    setMenuOpen,
    loading,
    busy,
    snack,
    setSnack,
    selected,
    canSubmit,
    submit,
    navigation,
    hasNoLocations,
    allLocationsListed,
  } = props;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator color={colors.primary.main} />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      avoidingViewStyle={styles.flex}
      contentContainerStyle={[styles.content, { padding: spacing.md }]}
      wrapAvoidingView={false}
    >
      {itemName ? (
        <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: 4 }}>
          {itemName}
        </Text>
      ) : null}
      <Text
        variant="bodyMedium"
        style={{ color: colors.text.secondary, marginBottom: spacing.md }}
      >
        {t(
          'business.rentals.addListingHint',
          'Choose a location that does not already list this rental, then set rates.'
        )}
      </Text>

      {hasNoLocations ? (
        <Button
          mode="outlined"
          icon="map-marker-plus"
          onPress={() => navigation.navigate('BusinessLocationForm', {})}
        >
          {t('business.rentals.wizard.location.addLocation', 'New location')}
        </Button>
      ) : allLocationsListed ? (
        <Text style={{ color: colors.text.secondary, marginBottom: spacing.md }}>
          {t(
            'business.rentals.allLocationsListed',
            'This rental is already listed at every location. Add a new location to list it elsewhere.'
          )}
        </Text>
      ) : (
        <>
          <Text
            variant="labelLarge"
            style={{ color: colors.text.secondary, marginBottom: 6 }}
          >
            {t('business.rentals.wizard.location.select', 'Location')}
          </Text>
          <Menu
            visible={menuOpen}
            onDismiss={() => setMenuOpen(false)}
            anchor={
              <Button
                mode="outlined"
                icon="menu-down"
                contentStyle={styles.dropdownContent}
                onPress={() => setMenuOpen(true)}
                disabled={busy || !availableLocations.length}
                accessibilityRole="button"
                accessibilityHint={t(
                  'business.rentals.wizard.location.selectHint',
                  'Opens a list of locations'
                )}
              >
                {selected?.name ??
                  t('business.rentals.wizard.location.selectPlaceholder', 'Select location')}
              </Button>
            }
          >
            {availableLocations.map((loc) => (
              <Menu.Item
                key={loc.id}
                onPress={() => {
                  setLocationId(loc.id);
                  setMenuOpen(false);
                }}
                title={loc.name}
              />
            ))}
          </Menu>
        </>
      )}

      {!hasNoLocations ? (
        <Button
          mode="text"
          icon="plus"
          onPress={() => navigation.navigate('BusinessLocationForm', {})}
          style={{ marginTop: 4 }}
        >
          {t('business.rentals.wizard.location.addLocation', 'New location')}
        </Button>
      ) : null}

      <TextInput
        label={t('business.rentals.wizard.location.hourly', 'Hourly rate')}
        value={hourly}
        onChangeText={setHourly}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy || allLocationsListed}
        style={styles.field}
      />
      <TextInput
        label={t(
          'business.rentals.wizard.location.daily',
          'Daily rate (optional)'
        )}
        value={daily}
        onChangeText={setDaily}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy || allLocationsListed}
        style={styles.field}
      />
      <TextInput
        label={t(
          'business.rentals.wizard.location.deposit',
          'Security deposit (optional)'
        )}
        value={deposit}
        onChangeText={setDeposit}
        keyboardType="decimal-pad"
        mode="outlined"
        disabled={busy || allLocationsListed}
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.wizard.location.depositHelp',
          'Held on card rentals to cover extra hours. Default is 8× the hourly rate.'
        )}
      </Text>
      <TextInput
        label={t('business.rentals.units', 'Units available')}
        value={units}
        onChangeText={setUnits}
        keyboardType="number-pad"
        mode="outlined"
        disabled={busy || allLocationsListed}
        style={styles.field}
      />
      <Text
        variant="bodySmall"
        style={{ color: colors.text.secondary, marginBottom: spacing.sm }}
      >
        {t(
          'business.rentals.unitsHelp',
          'How many identical units can be rented at once?'
        )}
      </Text>
      <TextInput
        label={t('business.rentals.wizard.location.pickup', 'Pickup notes')}
        value={pickup}
        onChangeText={setPickup}
        mode="outlined"
        multiline
        disabled={busy || allLocationsListed}
        style={styles.field}
      />
      <TextInput
        label={t('business.rentals.wizard.location.dropoff', 'Return notes')}
        value={dropoff}
        onChangeText={setDropoff}
        mode="outlined"
        multiline
        disabled={busy || allLocationsListed}
        style={styles.field}
      />

      <View style={{ marginTop: spacing.md, gap: 10 }}>
        <Button
          mode="contained"
          loading={busy}
          disabled={!canSubmit || allLocationsListed}
          onPress={() => void submit(true)}
        >
          {t('business.rentals.addListingPublish', 'Add & publish')}
        </Button>
        <Button
          mode="outlined"
          disabled={!canSubmit || allLocationsListed}
          onPress={() => void submit(false)}
        >
          {t('business.rentals.addListingDraft', 'Add as draft')}
        </Button>
      </View>

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 40 },
  field: { marginTop: 12 },
  dropdownContent: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
});
