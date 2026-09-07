import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { businessApi } from '../../services/businessApi';
import { rentalsApi } from '../../services/rentalsApi';
import type { BusinessLocation } from '../../types/business/locations';
import type { BusinessRentalItemDetail } from '../../types/rentals';
import type { BusinessRootStackParamList } from '../../navigation/types';
import { defaultWeeklyAvailability } from '../../utils/rentals';

type Route = RouteProp<BusinessRootStackParamList, 'BusinessRentalAddListing'>;
type Nav = NativeStackNavigationProp<BusinessRootStackParamList>;

export function useBusinessRentalAddListing() {
  const { t } = useTranslation();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const itemId = route.params.itemId;
  const seededRef = useRef(false);

  const [itemName, setItemName] = useState('');
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [listedIds, setListedIds] = useState<Set<string>>(() => new Set());
  const [locationId, setLocationId] = useState('');
  const [hourly, setHourly] = useState('');
  const [daily, setDaily] = useState('');
  const [deposit, setDeposit] = useState('');
  const [units, setUnits] = useState('1');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const availableLocations = useMemo(
    () => locations.filter((loc) => !listedIds.has(loc.id)),
    [listedIds, locations]
  );
  const selected = availableLocations.find((l) => l.id === locationId);
  const hourlyNum = parseFloat(hourly);
  const dailyNum = daily.trim() ? parseFloat(daily) : hourlyNum * 12;
  const depositNum = deposit.trim() ? parseFloat(deposit) : undefined;
  const unitsNum = Math.floor(Number(units));
  const canSubmit =
    !busy &&
    !loading &&
    !!locationId &&
    Number.isFinite(hourlyNum) &&
    hourlyNum >= 0 &&
    (depositNum === undefined ||
      (Number.isFinite(depositNum) && depositNum >= 0)) &&
    Number.isInteger(unitsNum) &&
    unitsNum >= 1;

  const applyItem = useCallback(
    (item: BusinessRentalItemDetail | null) => {
      setItemName(item?.name ?? '');
      const listed = new Set(
        (item?.rental_location_listings ?? [])
          .filter((l) => !l.deleted_at)
          .map((l) => l.business_location_id)
      );
      setListedIds(listed);
      if (!seededRef.current) {
        seededRef.current = true;
        seedPrices(item?.rental_location_listings ?? [], setHourly, setDaily);
      }
      return listed;
    },
    []
  );

  const applyLocations = useCallback(
    (list: BusinessLocation[], listed: Set<string>) => {
      setLocations(list);
      const first = list.find((l) => !listed.has(l.id));
      setLocationId((prev) =>
        prev && !listed.has(prev) ? prev : first?.id ?? ''
      );
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [item, locRes] = await Promise.all([
        rentalsApi.getBusinessItem(itemId),
        businessApi.locations.list(),
      ]);
      const listed = applyItem(item);
      applyLocations(locRes.data?.business_locations ?? [], listed);
    } catch (e: unknown) {
      setSnack(
        e instanceof Error
          ? e.message
          : t('business.rentals.loadError', 'Could not load rentals')
      );
    } finally {
      setLoading(false);
    }
  }, [applyItem, applyLocations, itemId, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const createListing = useCallback(async () => {
    const day = Number.isFinite(dailyNum) ? dailyNum : hourlyNum * 12;
    const created = await rentalsApi.createBusinessListing({
      rental_item_id: itemId,
      business_location_id: locationId,
      base_price_per_hour: hourlyNum,
      base_price_per_day: day,
      ...(depositNum !== undefined && Number.isFinite(depositNum)
        ? { security_deposit_amount: depositNum }
        : {}),
      units_available: unitsNum,
      pickup_instructions: pickup.trim() || undefined,
      dropoff_instructions: dropoff.trim() || undefined,
      weekly_availability: defaultWeeklyAvailability(),
    });
    const listingId = created.data?.id;
    if (!listingId) {
      throw new Error(
        t('business.rentals.addListingFailed', 'Could not create listing')
      );
    }
    return listingId;
  }, [dailyNum, depositNum, dropoff, hourlyNum, itemId, locationId, pickup, t, unitsNum]);

  const submit = useCallback(
    async (publish: boolean) => {
      if (!canSubmit) return;
      setBusy(true);
      try {
        const listingId = await createListing();
        if (publish) await rentalsApi.publishBusinessListing(listingId);
        navigation.goBack();
      } catch (e: unknown) {
        setSnack(
          e instanceof Error
            ? e.message
            : t('business.rentals.addListingFailed', 'Could not create listing')
        );
      } finally {
        setBusy(false);
      }
    },
    [canSubmit, createListing, navigation, t]
  );

  return {
    itemName,
    availableLocations,
    locationId,
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
    hasNoLocations: !loading && locations.length === 0,
    allLocationsListed:
      !loading && locations.length > 0 && availableLocations.length === 0,
  };
}

function seedPrices(
  listings: {
    deleted_at?: string | null;
    base_price_per_hour?: number | null;
    base_price_per_day?: number | null;
  }[],
  setHourly: (v: string) => void,
  setDaily: (v: string) => void
) {
  const existing = listings.find((l) => !l.deleted_at);
  if (!existing) return;
  if (existing.base_price_per_hour != null) {
    setHourly(String(existing.base_price_per_hour));
  }
  if (existing.base_price_per_day != null) {
    setDaily(String(existing.base_price_per_day));
  }
}
