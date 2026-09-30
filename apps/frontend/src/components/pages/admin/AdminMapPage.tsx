import { Alert, Box, Stack, Typography } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../../../hooks/usePermissions';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import { useAdminMapPins, useAdminMapRegions } from '../../../hooks/useAdminMap';
import AdminMapCanvas from '../../admin/map/AdminMapCanvas';
import AdminMapLegend from '../../admin/map/AdminMapLegend';
import AdminMapPinPanel from '../../admin/map/AdminMapPinPanel';
import AdminMapToolbar from '../../admin/map/AdminMapToolbar';
import { AdminMapKind, AdminMapPin } from '../../admin/map/adminMap.types';

const AdminMapPage: React.FC = () => {
  const { isSuperuser } = usePermissions();
  if (!isSuperuser) return <Denied />;
  return <MapWorkspace />;
};

function Denied() {
  const { t } = useTranslation();
  return (
    <Alert severity="error" sx={{ m: 2 }}>
      {t('admin.map.accessDenied', 'Only a superuser can open the map.')}
    </Alert>
  );
}

function MapWorkspace() {
  const model = useMapModel();
  return (
    <Stack spacing={2} sx={{ p: 2, height: 'calc(100vh - 120px)', minHeight: 640 }}>
      <MapHeading />
      <AdminMapToolbar {...model.toolbar} />
      <AdminMapLegend />
      <MapStatus loading={model.pins.loading} error={model.pins.error} empty={!model.pins.loading && model.pins.pins.length === 0} />
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
      />
      {model.selected ? <AdminMapPinPanel pin={model.selected} onClose={model.clear} /> : null}
    </Stack>
  );
}

function useMapModel() {
  const filters = useMapFilters();
  const pins = useAdminMapPins(
    { country: filters.country, state: filters.region, kind: filters.kind },
    filters.live
  );
  const [zoom, setZoom] = useState(6);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pins.pins.find((pin) => pin.id === selectedId) ?? null;
  const select = useCallback((pin: AdminMapPin) => setSelectedId(pin.id), []);
  const clear = useCallback(() => setSelectedId(null), []);
  const filterKey = `${filters.country}|${filters.region}|${filters.kind}`;
  return { toolbar: filters, pins, zoom, setZoom, selected, filterKey, select, clear };
}

function useMapFilters() {
  const { countries } = useSupportedCountries();
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [kind, setKind] = useState<AdminMapKind>('all');
  const [live, setLive] = useState(false);
  const regions = useAdminMapRegions(country);
  const onCountry = (value: string) => {
    setCountry(value);
    setRegion('');
  };
  return {
    countries, regions, country, region, kind, live,
    onCountry, onRegion: setRegion, onKind: setKind, onLive: setLive,
  };
}

export default AdminMapPage;
