import { Alert, Box, Stack, Typography } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../../hooks/usePermissions';
import { PlatformPermissions } from '../../../constants/platformPermissions';
import { useUserProfileContext } from '../../../contexts/UserProfileContext';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import { useAdminMapPins, useSeededMapMarket } from '../../../hooks/useAdminMap';
import AdminMapCanvas from '../../admin/map/AdminMapCanvas';
import AdminMapLegend from '../../admin/map/AdminMapLegend';
import AdminMapPinPanel from '../../admin/map/AdminMapPinPanel';
import AdminMapSearch from '../../admin/map/AdminMapSearch';
import AdminMapSummaryBar from '../../admin/map/AdminMapSummary';
import AdminMapToolbar from '../../admin/map/AdminMapToolbar';
import {
  activitiesForKind,
  AdminMapActivityFilter,
  AdminMapKind,
  AdminMapPin,
} from '../../admin/map/adminMap.types';

const AdminMapPage: React.FC = () => {
  const { can } = usePermissions();
  if (!can(PlatformPermissions.OPS_MAP)) return <Denied />;
  return <MapWorkspace />;
};

function Denied() {
  const { t } = useTranslation();
  return (
    <Alert severity="error" sx={{ m: 2 }}>
      {t('admin.map.accessDenied', 'You do not have access to the map.')}
    </Alert>
  );
}

function MapWorkspace() {
  const model = useMapModel();
  return (
    <Stack spacing={2} sx={{ p: 2, height: 'calc(100vh - 120px)', minHeight: 640 }}>
      <MapHeading />
      <AdminMapToolbar {...model.toolbar} />
      <AdminMapSearch onFocus={model.focusPin} />
      {model.focusNote ? <OrderFocusNote orderNumber={model.focusNote} /> : null}
      <AdminMapSummaryBar summary={model.pins.summary} />
      <AdminMapLegend />
      <MapStatus
        loading={model.pins.loading}
        error={model.pins.error}
        empty={!model.pins.loading && model.pins.pins.length === 0 && !model.focus}
      />
      <MapBody model={model} />
    </Stack>
  );
}

function MapHeading() {
  const { t } = useTranslation();
  return (
    <Box>
      <Typography variant="h5">{t('admin.map.title', 'Map')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('admin.map.subtitle', 'Agents and merchants in your markets')}
      </Typography>
    </Box>
  );
}

function OrderFocusNote({ orderNumber }: { orderNumber: string }) {
  const { t } = useTranslation();
  return (
    <Alert severity="success">
      {t('admin.map.orderHere', 'Order {{number}} is at this place.', { number: orderNumber })}
    </Alert>
  );
}

function MapStatus({ loading, error, empty }: { loading: boolean; error: string | null; empty: boolean }) {
  const { t } = useTranslation();
  if (loading) return <Alert severity="info">{t('admin.map.loading', 'Loading map…')}</Alert>;
  if (error) return <Alert severity="error">{t('admin.map.loadError', 'Could not load the map.')}</Alert>;
  if (empty) return <Alert severity="info">{t('admin.map.empty', 'No agents or merchants with a location in this view.')}</Alert>;
  return null;
}

function MapBody({ model }: { model: ReturnType<typeof useMapModel> }) {
  const { t } = useTranslation();
  const activityLabel = useCallback(
    (pin: AdminMapPin) => t(`admin.map.activity.${pin.activity}`, pin.activity),
    [t]
  );
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} sx={{ flex: 1, minHeight: 480, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <AdminMapCanvas
        pins={model.pins.pins}
        filterKey={model.filterKey}
        ready={!model.pins.loading}
        zoom={model.zoom}
        activityLabel={activityLabel}
        onZoom={model.setZoom}
        onSelect={model.select}
        focusPin={model.focus?.pin ?? null}
        focusToken={model.focus?.token ?? 0}
      />
      {model.selected ? <AdminMapPinPanel pin={model.selected} onClose={model.clear} /> : null}
    </Stack>
  );
}

function useMapModel() {
  const filters = useMapFilters();
  const loaded = useAdminMapPins(
    { country: filters.country, state: filters.region, kind: filters.kind },
    filters.live
  );
  const pins = { ...loaded, pins: pinsForActivity(loaded.pins, filters.activity) };
  const focus = useMapFocus(pins.pins);
  const filterKey = `${filters.country}|${filters.region}|${filters.kind}|${filters.activity}`;
  useDropFocusOnFilter(filterKey, focus.drop);
  return { toolbar: filters, pins, filterKey, ...focus };
}

function pinsForActivity(pins: AdminMapPin[], activity: AdminMapActivityFilter): AdminMapPin[] {
  if (!activity) return pins;
  return pins.filter((pin) => pin.activity === activity);
}

function useDropFocusOnFilter(filterKey: string, drop: () => void) {
  const seen = useRef(filterKey);
  useEffect(() => {
    if (seen.current === filterKey) return;
    seen.current = filterKey;
    drop();
  }, [filterKey, drop]);
}

function useMapFocus(pins: AdminMapPin[]) {
  const bag = useFocusBag();
  const selected = pins.find((pin) => pin.id === bag.selectedId) ?? focusedPin(bag.focus, bag.selectedId);
  return {
    zoom: bag.zoom, setZoom: bag.setZoom, selected, select: bag.select,
    clear: bag.clear, drop: bag.drop, focus: bag.focus, focusPin: bag.focusPin, focusNote: bag.focusNote,
  };
}

function useFocusBag() {
  const [zoom, setZoom] = useState(6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ pin: AdminMapPin; token: number } | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const select = useCallback((pin: AdminMapPin) => {
    setSelectedId(pin.id);
    setFocusNote(null);
  }, []);
  const focusPin = useCallback((pin: AdminMapPin, orderNumber: string | null) => {
    setSelectedId(pin.id);
    setFocus({ pin, token: Date.now() });
    setFocusNote(orderNumber);
  }, []);
  const clear = useCallback(() => {
    setSelectedId(null);
    setFocusNote(null);
  }, []);
  const drop = useCallback(() => {
    setSelectedId(null);
    setFocus(null);
    setFocusNote(null);
  }, []);
  return { zoom, setZoom, selectedId, focus, focusNote, select, focusPin, clear, drop };
}

function focusedPin(
  focus: { pin: AdminMapPin; token: number } | null,
  selectedId: string | null
): AdminMapPin | null {
  return focus?.pin.id === selectedId ? focus.pin : null;
}

function useMapFilters() {
  const { profile } = useUserProfileContext();
  const scopes = profile?.admin_scopes ?? [];
  const { countries: allCountries } = useSupportedCountries();
  const place = useSeededMapMarket();
  useClampMapPlace(place, scopes);
  const choice = useKindAndActivity();
  const [live, setLive] = useState(false);
  return {
    countries: countriesForScopes(allCountries, scopes),
    regions: regionsForScope(place.regions, scopes, place.country),
    country: place.country,
    region: place.region,
    live,
    onCountry: place.onCountry,
    onRegion: place.onRegion,
    onLive: setLive,
    ...choice,
  };
}

function useKindAndActivity() {
  const [kind, setKind] = useState<AdminMapKind>('all');
  const [activity, setActivity] = useState<AdminMapActivityFilter>('');
  const onKind = (next: AdminMapKind) => {
    setKind(next);
    setActivity((current) => keepActivity(next, current));
  };
  return { kind, activity, onKind, onActivity: setActivity };
}

function keepActivity(kind: AdminMapKind, activity: AdminMapActivityFilter): AdminMapActivityFilter {
  if (!activity || activitiesForKind(kind).includes(activity)) return activity;
  return '';
}

type AdminScope = { countryCode: string; states: string[] | null };

function useClampMapPlace(
  place: {
    country: string;
    region: string;
    regions: string[];
    onCountry: (value: string) => void;
    onRegion: (value: string) => void;
  },
  scopes: AdminScope[]
) {
  const allowed = regionsForScope(place.regions, scopes, place.country);
  useEffect(() => {
    const next = fallbackCountry(scopes, place.country);
    if (next) place.onCountry(next);
  }, [place, scopes]);
  useEffect(() => {
    if (place.region && !allowed.includes(place.region)) place.onRegion('');
  }, [allowed, place]);
}

function fallbackCountry(scopes: AdminScope[], country: string): string | null {
  if (!scopes.length || scopes.some((scope) => scope.countryCode === country)) {
    return null;
  }
  return scopes[0].countryCode;
}

function countriesForScopes<T extends { code: string }>(
  countries: T[],
  scopes: AdminScope[]
): T[] {
  if (!scopes.length) return countries;
  const codes = new Set(scopes.map((scope) => scope.countryCode));
  return countries.filter((country) => codes.has(country.code));
}

function regionsForScope(regions: string[], scopes: AdminScope[], country: string) {
  const scope = scopes.find((item) => item.countryCode === country);
  if (!scope || scope.states === null) return regions;
  const allowed = new Set(scope.states.map((name) => name.toLowerCase()));
  return regions.filter((name) => allowed.has(name.toLowerCase()));
}

export default AdminMapPage;
